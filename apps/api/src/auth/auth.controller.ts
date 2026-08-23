import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Body } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { randomBytes } from 'node:crypto';
import type { Request, Response, CookieOptions } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuditAction, CsrfExempt, CurrentUser, Public } from '../common/decorators';
import type { RequestUser } from '../common/types';
import { AuthService } from './auth.service';
import { LoginDto } from './dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @CsrfExempt()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @AuditAction('auth.login', 'Session')
  @ApiOperation({ summary: '账号密码登录' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: RequestUser }> {
    const result = await this.auth.login(dto.username.trim(), dto.password);
    this.setAuthCookies(response, result.accessToken, result.refreshToken);
    this.setCsrfCookie(response);
    return { user: result.user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: '旋转刷新凭证' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: RequestUser }> {
    const result = await this.auth.refresh(request.cookies?.refresh_token as string | undefined);
    this.setAuthCookies(response, result.accessToken, result.refreshToken);
    this.setCsrfCookie(response);
    return { user: result.user };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(request.cookies?.refresh_token as string | undefined);
    response.clearCookie('access_token', this.cookieOptions());
    response.clearCookie('refresh_token', { ...this.cookieOptions(), path: '/api/v2/auth' });
    response.clearCookie('csrf_token', { path: '/', sameSite: 'strict', secure: this.isSecure() });
  }

  @Get('me')
  me(@CurrentUser() user: RequestUser): RequestUser {
    return user;
  }

  @Public()
  @Get('csrf')
  csrf(@Res({ passthrough: true }) response: Response): { issued: true } {
    this.setCsrfCookie(response);
    return { issued: true };
  }

  private setAuthCookies(response: Response, accessToken: string, refreshToken: string): void {
    response.cookie('access_token', accessToken, { ...this.cookieOptions(), maxAge: 15 * 60_000 });
    response.cookie('refresh_token', refreshToken, {
      ...this.cookieOptions(),
      path: '/api/v2/auth',
      maxAge: 7 * 86_400_000,
    });
  }
  private setCsrfCookie(response: Response): void {
    response.cookie('csrf_token', randomBytes(24).toString('base64url'), {
      httpOnly: false,
      secure: this.isSecure(),
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 86_400_000,
    });
  }
  private cookieOptions(): CookieOptions {
    return { httpOnly: true, secure: this.isSecure(), sameSite: 'strict', path: '/' };
  }
  private isSecure(): boolean {
    return this.config.get('COOKIE_SECURE', 'false') === 'true';
  }
}
