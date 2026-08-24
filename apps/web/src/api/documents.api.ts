import { api } from './client';
import type { DocumentRecord } from '../types/domain';
export const documentsApi = {
  list: async (projectId: string) =>
    (await api.get<DocumentRecord[]>(`/projects/${projectId}/documents`)).data,
  upload: async (projectId: string, form: FormData) =>
    (
      await api.post(`/projects/${projectId}/documents`, form, {
        headers: { 'content-type': 'multipart/form-data' },
      })
    ).data,
  review: async (id: string, status: 'APPROVED' | 'REJECTED', comment?: string) =>
    (await api.post(`/documents/${id}/reviews`, { status, comment })).data,
  submit: async (id: string) => (await api.post(`/documents/${id}/submit`)).data,
  addVersion: async (id: string, form: FormData) =>
    (
      await api.post(`/documents/${id}/versions`, form, {
        headers: { 'content-type': 'multipart/form-data' },
      })
    ).data,
  remove: async (id: string) => api.delete(`/documents/${id}`),
  downloadUrl: (versionId: string) => `/api/v2/document-versions/${versionId}/download`,
};
