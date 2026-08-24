import { api } from './client';
import type {
  DailyReportListQuery,
  GenerateWeeklyReportInput,
  UpsertDailyReportInput,
} from '@pmp/shared-types';
export const reportsApi = {
  daily: async (params?: DailyReportListQuery) =>
    (await api.get('/reports/daily', { params })).data,
  upsertDaily: async (input: UpsertDailyReportInput) =>
    (await api.post('/reports/daily', input)).data,
  weekly: async () => (await api.get('/reports/weekly')).data,
  generateWeekly: async (input: GenerateWeeklyReportInput) =>
    (await api.post('/reports/weekly/generate', input)).data,
};
