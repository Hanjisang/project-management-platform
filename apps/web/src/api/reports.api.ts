import { api } from './client';
export const reportsApi = {
  daily: async (params?: Record<string, unknown>) =>
    (await api.get('/reports/daily', { params })).data,
  upsertDaily: async (input: Record<string, unknown>) =>
    (await api.post('/reports/daily', input)).data,
  weekly: async () => (await api.get('/reports/weekly')).data,
  generateWeekly: async (input: Record<string, unknown>) =>
    (await api.post('/reports/weekly/generate', input)).data,
};
