import { CallHandler, ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, mergeMap, type Observable } from 'rxjs';
import { AUDIT_ACTION_KEY } from '../common/decorators';
import type { AuthenticatedRequest } from '../common/types';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.getAllAndOverride<{ action: string; resourceType: string }>(
      AUDIT_ACTION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!metadata) return next.handle();
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return next.handle().pipe(
      mergeMap((data: unknown) =>
        from(
          this.audit.record(
            {
              user: request.user,
              requestId: request.requestId,
              ipAddress: request.ip,
              userAgent: request.header('user-agent'),
            },
            metadata.action,
            metadata.resourceType,
            this.parameter(
              request.params.id ??
                request.params.projectId ??
                request.params.documentId ??
                request.params.taskId ??
                request.params.deliverableId ??
                request.params.templateId,
            ),
            undefined,
            data,
          ),
        ).pipe(mergeMap(() => [data])),
      ),
    );
  }
  private parameter(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }
}
