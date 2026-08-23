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
  downloadUrl: (versionId: string) => `/api/v2/document-versions/${versionId}/download`,
};
