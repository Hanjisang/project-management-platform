import { CallHandler, ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import type { RequestWithId } from './types';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithId>();
    return next.handle().pipe(
      map((data: unknown) => ({
        success: true,
        data: this.serializeBigInts(data),
        requestId: request.requestId,
      })),
    );
  }

  private serializeBigInts(value: unknown): unknown {
    if (typeof value === 'bigint') return value.toString();
    if (Array.isArray(value)) return value.map((item) => this.serializeBigInts(item));
    if (value instanceof Date || Buffer.isBuffer(value) || value === null) return value;
    if (typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, this.serializeBigInts(item)]),
      );
    return value;
  }
}
