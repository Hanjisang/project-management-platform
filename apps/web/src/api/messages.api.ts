import { api } from './client';
import type { MessageRecord, Page } from '../types/domain';
export const messagesApi = {
  list: async (params?: Record<string, unknown>) =>
    (await api.get<Page<MessageRecord>>('/messages', { params })).data,
  create: async (input: Record<string, unknown>) =>
    (await api.post('/messages/manual', input)).data,
  analyze: async (id: string) => (await api.post(`/messages/${id}/analyze`)).data,
  confirm: async (
    id: string,
    decisions: Array<{
      actionId: string;
      decision: 'CONFIRM' | 'REJECT';
      payload?: Record<string, unknown>;
    }>,
  ) => (await api.post(`/messages/${id}/confirm`, { decisions })).data,
  aiStatus: async () =>
    (
      await api.get<{ configured: boolean; provider: string; model?: string }>(
        '/messages/ai-status',
      )
    ).data,
};
