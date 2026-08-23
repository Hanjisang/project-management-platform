import type { AuthUser } from '@pmp/shared-types';
import { api } from './client';
export const authApi = {
  me: async () => (await api.get<AuthUser>('/auth/me')).data,
  login: async (input: { username: string; password: string }) =>
    (await api.post<{ user: AuthUser }>('/auth/login', input)).data.user,
  logout: async () => {
    await api.post('/auth/logout');
  },
};
