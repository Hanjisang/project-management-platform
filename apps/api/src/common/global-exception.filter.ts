import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '@prisma/client';
import type { RequestWithId } from './types';

interface ErrorShape {
  code?: string;
  message?: string | string[];
  details?: unknown;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<RequestWithId>();
    let status =
      response.statusCode >= 400 ? response.statusCode : HttpStatus.INTERNAL_SERVER_ERROR;
    let code = this.defaultCode(status);
    let message = status === 429 ? '请求过于频繁，请稍后重试' : '服务器内部错误';
    let details: unknown;

    if (exception instanceof HttpException || this.isHttpExceptionLike(exception)) {
      status = exception.getStatus();
      code = this.defaultCode(status);
      const payload = exception.getResponse();
      if (typeof payload === 'string') message = payload;
      else {
        const shape = payload as ErrorShape;
        code = shape.code ?? this.defaultCode(status);
        message = Array.isArray(shape.message)
          ? shape.message.join('；')
          : (shape.message ?? message);
        details = shape.details;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        code = 'RESOURCE_CONFLICT';
        message = '数据已存在';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        code = 'RESOURCE_NOT_FOUND';
        message = '资源不存在';
      }
    }

    const body: Record<string, unknown> = {
      success: false,
      code,
      message,
      requestId: request.requestId,
    };
    if (details !== undefined) body.details = details;
    response.status(status).json(body);
  }

  private defaultCode(status: number): string {
    return (
      (
        {
          400: 'VALIDATION_FAILED',
          401: 'UNAUTHORIZED',
          403: 'FORBIDDEN',
          404: 'NOT_FOUND',
          409: 'CONFLICT',
          429: 'RATE_LIMITED',
        } as Record<number, string>
      )[status] ?? 'REQUEST_FAILED'
    );
  }

  private isHttpExceptionLike(
    exception: unknown,
  ): exception is { getStatus(): number; getResponse(): string | object } {
    return Boolean(
      exception &&
      typeof exception === 'object' &&
      'getStatus' in exception &&
      typeof exception.getStatus === 'function' &&
      'getResponse' in exception &&
      typeof exception.getResponse === 'function',
    );
  }
}
