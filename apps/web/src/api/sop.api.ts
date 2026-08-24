import { api } from './client';
import type { SopTemplate, SopVersion } from '../types/domain';
import type {
  CreateSopChecklistInput,
  CreateSopStageInput,
  CreateSopTaskInput,
  CreateSopTemplateInput,
  CreateSopVersionInput,
  UpdateSopStageInput,
  UpdateSopTaskInput,
} from '@pmp/shared-types';
export const sopApi = {
  list: async () => (await api.get<SopTemplate[]>('/sop/templates')).data,
  get: async (id: string) => (await api.get<SopTemplate>(`/sop/templates/${id}`)).data,
  createTemplate: async (input: CreateSopTemplateInput) =>
    (await api.post('/sop/templates', input)).data,
  createVersion: async (id: string, input: CreateSopVersionInput) =>
    (await api.post<SopVersion>(`/sop/templates/${id}/versions`, input)).data,
  createStage: async (id: string, input: CreateSopStageInput) =>
    (await api.post(`/sop/versions/${id}/stages`, input)).data,
  updateStage: async (id: string, input: UpdateSopStageInput) =>
    (await api.patch(`/sop/stages/${id}`, input)).data,
  removeStage: async (id: string) => api.delete(`/sop/stages/${id}`),
  createTask: async (id: string, input: CreateSopTaskInput) =>
    (await api.post(`/sop/stages/${id}/tasks`, input)).data,
  updateTask: async (id: string, input: UpdateSopTaskInput) =>
    (await api.patch(`/sop/tasks/${id}`, input)).data,
  removeTask: async (id: string) => api.delete(`/sop/tasks/${id}`),
  createChecklist: async (id: string, input: CreateSopChecklistInput) =>
    (await api.post(`/sop/tasks/${id}/checklist-items`, input)).data,
  removeChecklist: async (id: string) => api.delete(`/sop/checklist-items/${id}`),
  publish: async (id: string) => (await api.post(`/sop/versions/${id}/publish`)).data,
  clone: async (id: string, input: CreateSopVersionInput) =>
    (await api.post(`/sop/versions/${id}/clone`, input)).data,
};
