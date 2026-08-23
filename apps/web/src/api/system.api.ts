import { api } from './client';
import type { AuditRecord, Page, PermissionRecord, RoleRecord, UserRef } from '../types/domain';
export const systemApi = {
  users: async () =>
    (
      await api.get<
        Array<
          UserRef & {
            email?: string;
            status: string;
            roles: Array<{ role: { code: string; name: string } }>;
          }
        >
      >('/users')
    ).data,
  createUser: async (input: Record<string, unknown>) => (await api.post('/users', input)).data,
  roles: async () => (await api.get<RoleRecord[]>('/roles')).data,
  permissions: async () => (await api.get<PermissionRecord[]>('/roles/permissions')).data,
  createRole: async (input: Record<string, unknown>) =>
    (await api.post<RoleRecord>('/roles', input)).data,
  audit: async (params?: Record<string, unknown>) =>
    (await api.get<Page<AuditRecord>>('/audit', { params })).data,
};
