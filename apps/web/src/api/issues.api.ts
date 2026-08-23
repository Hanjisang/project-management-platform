import { api } from './client';
import type { Issue, Page } from '../types/domain';
export const issuesApi = {
  list: async (params?: Record<string, unknown>) =>
    (await api.get<Page<Issue>>('/issues', { params })).data,
  create: async (input: Record<string, unknown>) => (await api.post<Issue>('/issues', input)).data,
  update: async (id: string, input: Record<string, unknown>) =>
    (await api.patch<Issue>(`/issues/${id}`, input)).data,
};
