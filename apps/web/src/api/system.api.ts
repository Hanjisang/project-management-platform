import { api } from './client';
import type { AuditRecord, Page, PermissionRecord, RoleRecord, UserRef } from '../types/domain';
import type {
  AuditListQuery,
  CreateRoleInput,
  CreateUserInput,
  UpdateRoleInput,
  UpdateUserInput,
  UserStatus,
} from '@pmp/shared-types';
export const systemApi = {
  users: async () =>
    (
      await api.get<
        Array<
          UserRef & {
            email?: string;
            status: UserStatus;
            roles: Array<{ role: { code: string; name: string } }>;
          }
        >
      >('/users')
    ).data,
  createUser: async (input: CreateUserInput) => (await api.post('/users', input)).data,
  updateUser: async (id: string, input: UpdateUserInput) =>
    (await api.patch(`/users/${id}`, input)).data,
  roles: async () => (await api.get<RoleRecord[]>('/roles')).data,
  permissions: async () => (await api.get<PermissionRecord[]>('/roles/permissions')).data,
  createRole: async (input: CreateRoleInput) => (await api.post<RoleRecord>('/roles', input)).data,
  updateRole: async (id: string, input: UpdateRoleInput) =>
    (await api.patch<RoleRecord>(`/roles/${id}`, input)).data,
  audit: async (params?: AuditListQuery) =>
    (await api.get<Page<AuditRecord>>('/audit', { params })).data,
};
