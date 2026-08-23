import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { CsrfGuard } from './csrf.guard';

function context(method: string, cookie?: string, header?: string): ExecutionContext {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        cookies: cookie ? { csrf_token: cookie } : {},
        header: (name: string) => (name === 'x-csrf-token' ? header : undefined),
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('CsrfGuard', () => {
  it('rejects cookie-authenticated writes without a matching CSRF header', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as unknown as Reflector;
    const guard = new CsrfGuard(reflector);
    expect(() => guard.canActivate(context('POST', 'cookie-token'))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context('PATCH', 'cookie-token', 'other-token'))).toThrow(
      ForbiddenException,
    );
  });

  it('allows writes only with matching tokens or an explicit exemption', () => {
    const getAllAndOverride = vi.fn().mockReturnValue(false);
    const reflector = { getAllAndOverride } as unknown as Reflector;
    expect(new CsrfGuard(reflector).canActivate(context('POST', 'same-token', 'same-token'))).toBe(
      true,
    );
    getAllAndOverride.mockReturnValue(true);
    expect(new CsrfGuard(reflector).canActivate(context('POST'))).toBe(true);
  });

  it.each(['GET', 'HEAD', 'OPTIONS'])('does not require CSRF for %s', (method) => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as unknown as Reflector;
    expect(new CsrfGuard(reflector).canActivate(context(method))).toBe(true);
  });
});
