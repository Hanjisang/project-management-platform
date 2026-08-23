import type { Paginated } from '@pmp/shared-types';
export type Page<T> = Paginated<T>;
export interface UserRef {
  id: string;
  displayName: string;
  username?: string;
}
export interface Project {
  id: string;
  code: string;
  name: string;
  customerName: string;
  managerUserId: string;
  manager: UserRef;
  status: string;
  health: string;
  progress: number;
  plannedStartDate?: string;
  plannedGoLiveDate?: string;
  actualStartDate?: string;
  description?: string;
  _count?: {
    members: number;
    tasks: number;
    issues: number;
    documents?: number;
    messages?: number;
  };
  members?: ProjectMember[];
  plans?: Array<{ id: string; sourceVersion: { version: string; template: { name: string } } }>;
}
export interface ProjectMember {
  projectId: string;
  userId: string;
  projectRole: string;
  user: UserRef & { status?: string };
}
export interface ChecklistItem {
  id: string;
  name: string;
  completed: boolean;
  required: boolean;
}
export interface PlanTask {
  id: string;
  name: string;
  description?: string;
  progress: number;
  weight: number;
  required: boolean;
  deliverableRequired: boolean;
  deliverableName?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  owner?: UserRef;
  checklistItems: ChecklistItem[];
}
export interface PlanStage {
  id: string;
  name: string;
  progress: number;
  weight: number;
  plannedStartDate?: string;
  plannedEndDate?: string;
  tasks: PlanTask[];
}
export interface ProjectPlan {
  id: string;
  name: string;
  progress: number;
  sourceSopVersionId: string;
  stages: PlanStage[];
  sourceVersion?: { version: string; template: { name: string } };
}
export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  progress: number;
  dueDate?: string;
  project: Pick<Project, 'id' | 'code' | 'name'>;
  owner?: UserRef;
  planTask?: { id: string; name: string };
  zentaoSync?: { syncStatus: string; externalTaskId?: string };
}
export interface Issue {
  id: string;
  projectId: string;
  type: string;
  title: string;
  description?: string;
  severity: string;
  status: string;
  riskScore?: number;
  dueDate?: string;
  project: Pick<Project, 'id' | 'code' | 'name'>;
  owner?: UserRef;
}
export interface DocumentRecord {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  required: boolean;
  status: string;
  planTask?: { id: string; name: string };
  versions: Array<{
    id: string;
    version: string;
    fileName: string;
    mimeType: string;
    size: string;
    createdAt: string;
  }>;
  reviews: Array<{ id: string; status: string; comment?: string; reviewer: UserRef }>;
}
export interface PendingAction {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: string;
  resultResourceId?: string;
}
export interface MessageRecord {
  id: string;
  projectId?: string;
  source: string;
  senderName: string;
  content: string;
  receivedAt: string;
  status: string;
  project?: Pick<Project, 'id' | 'code' | 'name'>;
  pendingActions: PendingAction[];
  analyses?: Array<{
    id: string;
    status: string;
    result?: Record<string, unknown>;
    errorCode?: string;
  }>;
}
export interface SopTemplate {
  id: string;
  code: string;
  name: string;
  description?: string;
  versions: SopVersion[];
}
export interface SopVersion {
  id: string;
  version: string;
  status: string;
  publishedAt?: string;
  stages?: Array<{
    id: string;
    name: string;
    description?: string;
    sortOrder: number;
    defaultDurationDays: number;
    weight: number;
    tasks: Array<{
      id: string;
      name: string;
      description?: string;
      sortOrder: number;
      defaultDurationDays: number;
      weight: number;
      required: boolean;
      deliverableRequired: boolean;
      deliverableName?: string;
      checklistItems: Array<{ id: string; name: string; required: boolean }>;
    }>;
  }>;
}
export interface KnowledgeArticle {
  id: string;
  title: string;
  summary?: string;
  content: string;
  status: string;
  tags?: string[];
  category: { id: string; name: string };
  author: UserRef;
  reviewer?: UserRef;
  reviewComment?: string;
  updatedAt: string;
  attachments: Array<{ id: string; fileName: string; mimeType: string; size: string }>;
}
export interface DashboardData {
  summary: Record<string, number>;
  upcomingProjects: Project[];
  stageDistribution: Array<{ name: string; value: number }>;
  progressRanking: Project[];
  riskRanking: Project[];
  overdueTasks: Task[];
  highRiskIssues: Issue[];
  workload: Array<{
    userId: string;
    displayName: string;
    activeTaskCount: number;
    averageProgress: number;
  }>;
}
export interface RoleRecord {
  id: string;
  code: string;
  name: string;
  description?: string;
  system: boolean;
  permissions: Array<{ permission: { id: string; code: string; name: string } }>;
  _count: { users: number };
}
export interface PermissionRecord {
  id: string;
  code: string;
  name: string;
  description?: string;
}
export interface AuditRecord {
  id: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  requestId: string;
  ipAddress?: string;
  createdAt: string;
  user?: UserRef;
}
