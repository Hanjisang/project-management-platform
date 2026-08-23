import { api } from './client';
import type { Page, Project, ProjectPlan } from '../types/domain';
export const projectsApi = {
  list: async (params?: Record<string, unknown>) =>
    (await api.get<Page<Project>>('/projects', { params })).data,
  userOptions: async () =>
    (
      await api.get<Array<{ id: string; username: string; displayName: string }>>(
        '/project-user-options',
      )
    ).data,
  get: async (id: string) => (await api.get<Project>(`/projects/${id}`)).data,
  create: async (input: Record<string, unknown>) =>
    (await api.post<Project>('/projects', input)).data,
  update: async (id: string, input: Record<string, unknown>) =>
    (await api.patch<Project>(`/projects/${id}`, input)).data,
  action: async (id: string, action: 'start' | 'pause' | 'resume' | 'close') =>
    (await api.post<Project>(`/projects/${id}/${action}`)).data,
  members: async (id: string) => (await api.get<Project>(`/projects/${id}/members`)).data,
  setMembers: async (id: string, members: Array<{ userId: string; projectRole: string }>) =>
    (await api.put(`/projects/${id}/members`, { members })).data,
  plan: async (id: string) => (await api.get<ProjectPlan>(`/projects/${id}/plan`)).data,
  generatePlan: async (id: string, sopVersionId: string) =>
    (await api.post<ProjectPlan>(`/projects/${id}/plan`, { sopVersionId })).data,
  completeChecklist: async (id: string, completed: boolean) =>
    (await api.patch(`/checklist-items/${id}`, { completed })).data,
  syncPreview: async (id: string, sopVersionId: string) =>
    (await api.get(`/projects/${id}/plan/sync-preview`, { params: { sopVersionId } })).data,
  syncPlan: async (id: string, sopVersionId: string, acceptedDiffHash: string) =>
    (await api.post(`/projects/${id}/plan/sync`, { sopVersionId, acceptedDiffHash })).data,
};
