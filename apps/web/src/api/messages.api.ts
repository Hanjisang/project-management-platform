import { api } from './client';
import type { MessageRecord, Page } from '../types/domain';
import type {
  CreateManualMessageInput,
  MessageListQuery,
  PendingActionDecisionInput,
} from '@pmp/shared-types';
export const messagesApi = {
  list: async (params?: MessageListQuery) =>
    (await api.get<Page<MessageRecord>>('/messages', { params })).data,
  create: async (input: CreateManualMessageInput) =>
    (await api.post('/messages/manual', input)).data,
  analyze: async (id: string) => (await api.post(`/messages/${id}/analyze`)).data,
  confirm: async (id: string, decisions: PendingActionDecisionInput[]) =>
    (await api.post(`/messages/${id}/confirm`, { decisions })).data,
  aiStatus: async () =>
    (
      await api.get<{ configured: boolean; provider: string; model?: string }>(
        '/messages/ai-status',
      )
    ).data,
};
