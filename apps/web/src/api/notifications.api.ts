import { api } from './client';
import type { NotificationRecord } from '../types/domain';

export const notificationsApi = {
  list: async () =>
    (await api.get<{ items: NotificationRecord[]; unread: number }>('/notifications')).data,
  read: async (id: string) =>
    (await api.patch<NotificationRecord | null>(`/notifications/${id}/read`)).data,
};
