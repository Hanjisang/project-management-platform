import { api } from './client';
import type { Issue, Page } from '../types/domain';
import type { CreateIssueInput, IssueListQuery, UpdateIssueInput } from '@pmp/shared-types';
export const issuesApi = {
  list: async (params?: IssueListQuery) => (await api.get<Page<Issue>>('/issues', { params })).data,
  get: async (id: string) => (await api.get<Issue>(`/issues/${id}`)).data,
  create: async (input: CreateIssueInput) => (await api.post<Issue>('/issues', input)).data,
  update: async (id: string, input: UpdateIssueInput) =>
    (await api.patch<Issue>(`/issues/${id}`, input)).data,
  resolve: async (id: string) => (await api.post<Issue>(`/issues/${id}/resolve`)).data,
  close: async (id: string) => (await api.post<Issue>(`/issues/${id}/close`)).data,
};
