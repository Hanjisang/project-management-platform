import { api } from './client';
import type { Page, ProjectWorkItem } from '../types/domain';
import type { CreateWorkItemInput, TaskListQuery, UpdateWorkItemInput } from '@pmp/shared-types';
export const tasksApi = {
  list: async (params?: TaskListQuery) =>
    (await api.get<Page<ProjectWorkItem>>('/work-items', { params })).data,
  get: async (id: string) => (await api.get<ProjectWorkItem>(`/work-items/${id}`)).data,
  create: async (input: CreateWorkItemInput) => {
    const { projectId, ...payload } = input;
    return (await api.post<ProjectWorkItem>(`/projects/${projectId}/work-items`, payload)).data;
  },
  update: async (id: string, input: UpdateWorkItemInput) =>
    (await api.patch<ProjectWorkItem>(`/work-items/${id}`, input)).data,
  complete: async (id: string) =>
    (await api.post<ProjectWorkItem>(`/work-items/${id}/complete`)).data,
  cancel: async (id: string, reason?: string) =>
    (await api.post<ProjectWorkItem>(`/work-items/${id}/cancel`, { reason })).data,
};
