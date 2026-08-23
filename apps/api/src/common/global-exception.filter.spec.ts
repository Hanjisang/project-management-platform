import type { ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
  it('normalizes HttpException-compatible rate limit errors', () => {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status, statusCode: 200 }),
        getRequest: () => ({ requestId: 'request-id' }),
      }),
    } as unknown as ArgumentsHost;
    const throttlerLike = {
      getStatus: () => 429,
      getResponse: () => 'ThrottlerException: Too Many Requests',
    };

    new GlobalExceptionFilter().catch(throttlerLike, host);
    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith({
      success: false,
      code: 'RATE_LIMITED',
      message: 'ThrottlerException: Too Many Requests',
      requestId: 'request-id',
    });
  });
});
