import { createHmac, timingSafeEqual } from 'node:crypto';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DingtalkSignatureService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}
  async verify(
    timestamp: string | undefined,
    nonce: string | undefined,
    signature: string | undefined,
    rawBody: Buffer,
  ): Promise<void> {
    const secret = this.config.get<string>('DINGTALK_SIGNING_SECRET');
    if (!secret)
      throw new UnauthorizedException({
        code: 'DINGTALK_NOT_CONFIGURED',
        message: '钉钉回调验签未配置',
      });
    if (!timestamp || !nonce || !signature)
      throw new UnauthorizedException({
        code: 'DINGTALK_SIGNATURE_MISSING',
        message: '钉钉回调签名信息不完整',
      });
    const parsed = Number(timestamp);
    if (!Number.isFinite(parsed) || Math.abs(Date.now() - parsed) > 5 * 60_000)
      throw new UnauthorizedException({
        code: 'DINGTALK_TIMESTAMP_INVALID',
        message: '钉钉回调已过期',
      });
    const expected = createHmac('sha256', secret)
      .update(`${timestamp}\n${nonce}\n`)
      .update(rawBody)
      .digest('base64');
    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(signature);
    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    )
      throw new UnauthorizedException({
        code: 'DINGTALK_SIGNATURE_INVALID',
        message: '钉钉回调签名无效',
      });
    try {
      await this.prisma.integrationReplayNonce.create({
        data: { provider: 'dingtalk', nonce, expiresAt: new Date(Date.now() + 10 * 60_000) },
      });
    } catch {
      throw new ConflictException({
        code: 'DINGTALK_REPLAY_DETECTED',
        message: '钉钉回调重复或已被处理',
      });
    }
  }
}
