import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { RequestUser, AuthenticatedRequest } from './types';

export const IS_PUBLIC_KEY = 'isPublic';
export const CSRF_EXEMPT_KEY = 'csrfExempt';
export const PERMISSIONS_KEY = 'permissions';
export const PERMISSIONS_ANY_KEY = 'permissionsAny';
export const PROJECT_ACCESS_KEY = 'projectAccess';
export const AUDIT_ACTION_KEY = 'auditAction';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const CsrfExempt = () => SetMetadata(CSRF_EXEMPT_KEY, true);
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
export const RequireAnyPermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_ANY_KEY, permissions);
export const RequireProjectAccess = (parameter = 'projectId') =>
  SetMetadata(PROJECT_ACCESS_KEY, parameter);
export const AuditAction = (action: string, resourceType: string) =>
  SetMetadata(AUDIT_ACTION_KEY, { action, resourceType });

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestUser =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
