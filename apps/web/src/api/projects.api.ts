import { api } from './client';
import type { Page, Project, ProjectPlan } from '../types/domain';
import type {
  CreateProjectInput,
  ProjectListQuery,
  ProjectRole,
  UpdatePlanTaskInput,
  UpdateProjectInput,
} from '@pmp/shared-types';
export const projectsApi = {
  list: async (params?: ProjectListQuery) =>
    (await api.get<Page<Project>>('/projects', { params })).data,
  userOptions: async (params?: { search?: string; page?: number; pageSize?: number }) =>
    (
      await api.get<Page<{ id: string; username: string; displayName: string }>>(
        '/project-user-options',
        { params },
      )
    ).data,
  get: async (id: string) => (await api.get<Project>(`/projects/${id}`)).data,
  create: async (input: CreateProjectInput) => (await api.post<Project>('/projects', input)).data,
  update: async (id: string, input: UpdateProjectInput) =>
    (await api.patch<Project>(`/projects/${id}`, input)).data,
  remove: async (id: string) => api.delete(`/projects/${id}`),
  action: async (id: string, action: 'start' | 'pause' | 'resume' | 'close') =>
    (await api.post<Project>(`/projects/${id}/${action}`)).data,
  members: async (id: string) => (await api.get<Project>(`/projects/${id}/members`)).data,
  setMembers: async (id: string, members: Array<{ userId: string; projectRole: ProjectRole }>) =>
    (await api.put(`/projects/${id}/members`, { members })).data,
  plan: async (id: string) => (await api.get<ProjectPlan>(`/projects/${id}/plan`)).data,
  generatePlan: async (id: string, sopVersionId: string) =>
    (await api.post<ProjectPlan>(`/projects/${id}/plan`, { sopVersionId })).data,
  completeChecklist: async (id: string, completed: boolean) =>
    (await api.patch(`/work-item-checklist/${id}`, { completed })).data,
  updatePlanTask: async (id: string, input: UpdatePlanTaskInput) =>
    (await api.patch(`/work-items/${id}`, input)).data,
  execution: async (id: string) => (await api.get(`/projects/${id}/execution`)).data,
  syncPreview: async (id: string, sopVersionId: string) =>
    (await api.get(`/projects/${id}/plan/sync-preview`, { params: { sopVersionId } })).data,
  syncPlan: async (id: string, sopVersionId: string, acceptedDiffHash: string) =>
    (await api.post(`/projects/${id}/plan/sync`, { sopVersionId, acceptedDiffHash })).data,
  deliverableTemplateDownloadUrl: (id: string) =>
    `/api/v2/project-deliverable-templates/${id}/download`,
};
