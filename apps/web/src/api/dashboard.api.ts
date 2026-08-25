import { api } from './client';
import type { DashboardData } from '../types/domain';

export interface DashboardProjectCard {
  id: string;
  code: string;
  name: string;
  status: string;
  health: string;
  progress: number;
  isManager: boolean;
  currentStage: string;
  plannedGoLiveDate?: string | null;
  workItems: { done: number; total: number };
  checklist: { done: number; total: number };
  deliverables: { approved: number; total: number };
  overdueCount: number;
  blockedCount: number;
  unsubmittedRequiredDeliverables: number;
  pendingReviewCount: number;
  pendingChangeCount: number;
}

export type ExecutionDashboardData = DashboardData & {
  myProjects: DashboardProjectCard[];
};

export const dashboardApi = {
  get: async () => (await api.get<ExecutionDashboardData>('/dashboard')).data,
};
