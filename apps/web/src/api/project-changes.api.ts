import { api } from './client';
import type { ProjectChangeRequest } from '../types/domain';

export const projectChangesApi = {
  list: async (projectId: string) =>
    (await api.get<ProjectChangeRequest[]>(`/projects/${projectId}/change-requests`)).data,
  get: async (id: string) => (await api.get<ProjectChangeRequest>(`/change-requests/${id}`)).data,
  preflight: async (
    projectId: string,
    input: { proposedCompletionDate?: string; scopeChange?: boolean },
  ) => (await api.post(`/projects/${projectId}/change-impact/preflight`, input)).data,
  adjust: async (projectId: string, input: { proposedCompletionDate: string; reason: string }) =>
    (await api.post(`/projects/${projectId}/adjustments`, input)).data,
  create: async (projectId: string, input: Record<string, unknown>) =>
    (await api.post<ProjectChangeRequest>(`/projects/${projectId}/change-requests`, input)).data,
  submit: async (id: string) =>
    (await api.post<ProjectChangeRequest>(`/change-requests/${id}/submit`)).data,
  approve: async (id: string, comment?: string) =>
    (await api.post<ProjectChangeRequest>(`/change-requests/${id}/approve`, { comment })).data,
  reject: async (id: string, comment?: string) =>
    (await api.post<ProjectChangeRequest>(`/change-requests/${id}/reject`, { comment })).data,
  apply: async (id: string) =>
    (await api.post<ProjectChangeRequest>(`/change-requests/${id}/apply`)).data,
};
