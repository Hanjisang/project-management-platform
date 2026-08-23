import { api } from './client';
import type { KnowledgeArticle } from '../types/domain';
export const knowledgeApi = {
  categories: async () =>
    (await api.get<Array<{ id: string; name: string }>>('/knowledge/categories')).data,
  list: async (params?: Record<string, unknown>) =>
    (await api.get<KnowledgeArticle[]>('/knowledge/articles', { params })).data,
  get: async (id: string) => (await api.get<KnowledgeArticle>(`/knowledge/articles/${id}`)).data,
  create: async (input: Record<string, unknown>) =>
    (await api.post('/knowledge/articles', input)).data,
  submit: async (id: string) => (await api.post(`/knowledge/articles/${id}/submit`)).data,
  review: async (id: string, status: 'PUBLISHED' | 'REJECTED', comment?: string) =>
    (await api.post(`/knowledge/articles/${id}/review`, { status, comment })).data,
  uploadAttachment: async (id: string, file: File) => {
    const body = new FormData();
    body.append('file', file);
    return (
      await api.post(`/knowledge/articles/${id}/attachments`, body, {
        headers: { 'content-type': 'multipart/form-data' },
      })
    ).data;
  },
  attachmentUrl: (id: string) => `/api/v2/knowledge/attachments/${id}/download`,
};
