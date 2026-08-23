import { api } from './client';
import type { Page, Task } from '../types/domain';
export const tasksApi = {
  list: async (params?: Record<string, unknown>) =>
    (await api.get<Page<Task>>('/tasks', { params })).data,
  create: async (input: Record<string, unknown>) => (await api.post<Task>('/tasks', input)).data,
  update: async (id: string, input: Record<string, unknown>) =>
    (await api.patch<Task>(`/tasks/${id}`, input)).data,
};
