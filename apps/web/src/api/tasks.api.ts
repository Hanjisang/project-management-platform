import { api } from './client';
import type { Page, Task } from '../types/domain';
import type { CreateTaskInput, TaskListQuery, UpdateTaskInput } from '@pmp/shared-types';
export const tasksApi = {
  list: async (params?: TaskListQuery) => (await api.get<Page<Task>>('/tasks', { params })).data,
  create: async (input: CreateTaskInput) => (await api.post<Task>('/tasks', input)).data,
  update: async (id: string, input: UpdateTaskInput) =>
    (await api.patch<Task>(`/tasks/${id}`, input)).data,
  complete: async (id: string) => (await api.post<Task>(`/tasks/${id}/complete`)).data,
  remove: async (id: string) => api.delete(`/tasks/${id}`),
};
