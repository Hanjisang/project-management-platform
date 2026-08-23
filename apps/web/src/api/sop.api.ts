import { api } from './client';
import type { SopTemplate, SopVersion } from '../types/domain';
export const sopApi = {
  list: async () => (await api.get<SopTemplate[]>('/sop/templates')).data,
  get: async (id: string) => (await api.get<SopTemplate>(`/sop/templates/${id}`)).data,
  createTemplate: async (input: Record<string, unknown>) =>
    (await api.post('/sop/templates', input)).data,
  createVersion: async (id: string, input: Record<string, unknown>) =>
    (await api.post<SopVersion>(`/sop/templates/${id}/versions`, input)).data,
  createStage: async (id: string, input: Record<string, unknown>) =>
    (await api.post(`/sop/versions/${id}/stages`, input)).data,
  createTask: async (id: string, input: Record<string, unknown>) =>
    (await api.post(`/sop/stages/${id}/tasks`, input)).data,
  createChecklist: async (id: string, input: Record<string, unknown>) =>
    (await api.post(`/sop/tasks/${id}/checklist-items`, input)).data,
  publish: async (id: string) => (await api.post(`/sop/versions/${id}/publish`)).data,
  clone: async (id: string, input: Record<string, unknown>) =>
    (await api.post(`/sop/versions/${id}/clone`, input)).data,
};
