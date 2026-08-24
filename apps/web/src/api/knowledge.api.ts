import { api } from './client';
import type { KnowledgeArticle } from '../types/domain';
import type {
  CreateKnowledgeArticleInput,
  DepositDocumentInput,
  KnowledgeListQuery,
  UpdateKnowledgeArticleInput,
} from '@pmp/shared-types';
export const knowledgeApi = {
  categories: async () =>
    (await api.get<Array<{ id: string; name: string }>>('/knowledge/categories')).data,
  createCategory: async (name: string) => (await api.post('/knowledge/categories', { name })).data,
  list: async (params?: KnowledgeListQuery) =>
    (await api.get<KnowledgeArticle[]>('/knowledge/articles', { params })).data,
  get: async (id: string) => (await api.get<KnowledgeArticle>(`/knowledge/articles/${id}`)).data,
  create: async (input: CreateKnowledgeArticleInput) =>
    (await api.post('/knowledge/articles', input)).data,
  update: async (id: string, input: UpdateKnowledgeArticleInput) =>
    (await api.patch(`/knowledge/articles/${id}`, input)).data,
  remove: async (id: string) => api.delete(`/knowledge/articles/${id}`),
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
  removeAttachment: async (id: string) => api.delete(`/knowledge/attachments/${id}`),
  depositDocument: async (documentId: string, input: DepositDocumentInput) =>
    (await api.post(`/knowledge/documents/${documentId}/deposit`, input)).data,
  attachmentUrl: (id: string) => `/api/v2/knowledge/attachments/${id}/download`,
};
