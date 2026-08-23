import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ApiResponseInterceptor } from './api-response.interceptor';

describe('ApiResponseInterceptor', () => {
  it('serializes nested bigint values without changing dates', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ requestId: 'request-id' }) }),
    } as unknown as ExecutionContext;
    const next = {
      handle: vi.fn().mockReturnValue(of({ size: 12n, nested: [{ value: 3n }], createdAt })),
    } as unknown as CallHandler;

    await expect(
      firstValueFrom(new ApiResponseInterceptor().intercept(context, next)),
    ).resolves.toEqual({
      success: true,
      data: { size: '12', nested: [{ value: '3' }], createdAt },
      requestId: 'request-id',
    });
  });
});
