export interface ApiSuccess<T> {
  success: true;
  data: T;
  requestId: string;
}

export interface ApiFailure {
  success: false;
  code: string;
  message: string;
  requestId: string;
  details?: unknown;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  permissions: string[];
  isAdministrator: boolean;
}

export interface AiAnalysisResult {
  project: { id: string | null; name: string; confidence: number };
  summary: string;
  progressUpdates: Array<{ planTaskId: string; progress: number; evidence: string }>;
  issues: Array<{ title: string; description: string; severity: string }>;
  risks: Array<{
    title: string;
    description: string;
    severity: string;
    probability: number;
    impact: number;
  }>;
  tasks: Array<{ title: string; description: string; priority: string; dueDate: string | null }>;
  decisions: Array<{ content: string }>;
  followUps: Array<{ content: string; dueDate: string | null }>;
}

export interface SopDiffItem {
  operation: 'ADD' | 'REMOVE' | 'MODIFY';
  entity: 'STAGE' | 'TASK' | 'CHECKLIST';
  sourceId: string | null;
  planId: string | null;
  path: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface ProjectClosureBlockers {
  incompletePlanTasks: Array<{ id: string; name: string }>;
  incompleteTasks: Array<{ id: string; title: string }>;
  openHighPriorityIssues: Array<{ id: string; title: string }>;
  missingRequiredDeliverables: Array<{ id: string; name: string }>;
}
