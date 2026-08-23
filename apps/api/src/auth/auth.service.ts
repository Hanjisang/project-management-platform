import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestUser } from '../common/types';

interface TokenPayload {
  sub: string;
  type: 'access' | 'refresh';
  nonce?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(
    username: string,
    password: string,
  ): Promise<{ user: RequestUser; accessToken: string; refreshToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: this.userInclude(),
    });
    const now = new Date();
    if (
      !user ||
      user.deletedAt ||
      user.status !== 'ACTIVE' ||
      (user.lockedUntil && user.lockedUntil > now)
    ) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: '账号或密码错误' });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: attempts >= this.maxAttempts() ? new Date(Date.now() + 15 * 60_000) : null,
        },
      });
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: '账号或密码错误' });
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: now },
    });
    const tokens = await this.issueTokens(user.id);
    return { user: this.mapUser(user), ...tokens };
  }

  async refresh(
    rawToken: string | undefined,
  ): Promise<{ user: RequestUser; accessToken: string; refreshToken: string }> {
    if (!rawToken)
      throw new UnauthorizedException({ code: 'REFRESH_TOKEN_MISSING', message: '刷新凭证缺失' });
    let payload: TokenPayload;
    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(rawToken, {
        secret: this.refreshSecret(),
      });
    } catch {
      throw new UnauthorizedException({ code: 'REFRESH_TOKEN_INVALID', message: '刷新凭证无效' });
    }
    if (payload.type !== 'refresh')
      throw new UnauthorizedException({ code: 'REFRESH_TOKEN_INVALID', message: '刷新凭证无效' });
    const hash = this.hashToken(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt <= new Date() ||
      stored.userId !== payload.sub
    ) {
      throw new UnauthorizedException({ code: 'REFRESH_TOKEN_INVALID', message: '刷新凭证无效' });
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: this.userInclude(),
    });
    if (!user || user.status !== 'ACTIVE' || user.deletedAt)
      throw new UnauthorizedException({ code: 'USER_INACTIVE', message: '用户不可用' });
    const tokens = await this.prisma.$transaction(
      async (tx) => {
        const claimed = await tx.refreshToken.updateMany({
          where: { id: stored.id, revokedAt: null, expiresAt: { gt: new Date() } },
          data: { revokedAt: new Date() },
        });
        if (claimed.count !== 1)
          throw new UnauthorizedException({
            code: 'REFRESH_TOKEN_INVALID',
            message: '刷新凭证无效',
          });
        return this.issueTokens(user.id, tx);
      },
      { isolationLevel: 'Serializable' },
    );
    return { user: this.mapUser(user), ...tokens };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async loadUser(id: string): Promise<RequestUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id }, include: this.userInclude() });
    return user && !user.deletedAt && user.status === 'ACTIVE' ? this.mapUser(user) : null;
  }

  async verifyAccess(rawToken: string): Promise<TokenPayload> {
    const payload = await this.jwt.verifyAsync<TokenPayload>(rawToken, {
      secret: this.accessSecret(),
    });
    if (payload.type !== 'access') throw new Error('invalid token type');
    return payload;
  }

  private async issueTokens(
    userId: string,
    database: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, type: 'access' } satisfies TokenPayload,
      { secret: this.accessSecret(), expiresIn: '15m' },
    );
    const nonce = randomBytes(24).toString('base64url');
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, type: 'refresh', nonce } satisfies TokenPayload,
      { secret: this.refreshSecret(), expiresIn: '7d' },
    );
    await database.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
      },
    });
    return { accessToken, refreshToken };
  }

  private userInclude() {
    return {
      roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
    } as const;
  }
  private mapUser(
    user: Awaited<ReturnType<PrismaService['user']['findUnique']>> & Record<string, unknown>,
  ): RequestUser {
    const value = user as unknown as {
      id: string;
      username: string;
      displayName: string;
      roles: Array<{
        role: { code: string; permissions: Array<{ permission: { code: string } }> };
      }>;
    };
    const permissions = [
      ...new Set(
        value.roles.flatMap((entry) =>
          entry.role.permissions.map((permission) => permission.permission.code),
        ),
      ),
    ];
    return {
      id: value.id,
      username: value.username,
      displayName: value.displayName,
      permissions,
      isAdministrator: value.roles.some((entry) => entry.role.code === 'ADMINISTRATOR'),
    };
  }
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
  private accessSecret(): string {
    return this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
  }
  private refreshSecret(): string {
    return this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
  }
  private maxAttempts(): number {
    return Number(this.config.get('LOGIN_MAX_ATTEMPTS', 5));
  }
}
