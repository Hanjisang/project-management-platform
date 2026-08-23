import { api } from './client';
import type { DashboardData } from '../types/domain';
export const dashboardApi = { get: async () => (await api.get<DashboardData>('/dashboard')).data };
