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

export type ProjectStatus =
  'DRAFT' | 'NOT_STARTED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
export type ProjectHealth = 'NORMAL' | 'WARNING' | 'HIGH_RISK';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type IssueStatus = 'OPEN' | 'PROCESSING' | 'WAITING' | 'RESOLVED' | 'CLOSED';
export type IssueType = 'ISSUE' | 'RISK' | 'CHANGE' | 'BLOCKER';
export type IssueSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DocumentStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
export type KnowledgeStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED';
export type MessageStatus =
  | 'RECEIVED'
  | 'ANALYZING'
  | 'ANALYZED'
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'IGNORED'
  | 'FAILED';

export interface PageQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}
export interface ProjectListQuery extends PageQuery {
  status?: ProjectStatus | '';
  health?: ProjectHealth | '';
}
export type ProjectRole =
  'PROJECT_MANAGER' | 'IMPLEMENTER' | 'DEVELOPER' | 'PRODUCT' | 'TESTER' | 'VIEWER';
export interface CreateProjectInput {
  code: string;
  name: string;
  customerName: string;
  managerUserId: string;
  plannedStartDate?: string;
  plannedGoLiveDate?: string;
  description?: string;
}
export interface UpdateProjectInput {
  name?: string;
  customerName?: string;
  managerUserId?: string;
  plannedStartDate?: string;
  plannedGoLiveDate?: string;
  description?: string;
  healthOverride?: ProjectHealth | null;
}
export interface TaskListQuery extends PageQuery {
  projectId?: string;
  status?: TaskStatus | '';
  ownerUserId?: string;
}
export interface IssueListQuery extends PageQuery {
  projectId?: string;
  type?: IssueType | '';
  severity?: IssueSeverity | '';
  status?: IssueStatus | '';
}
export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string;
  ownerUserId?: string;
  planTaskId?: string;
  priority?: TaskPriority;
  plannedStartDate?: string;
  dueDate?: string;
}
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  ownerUserId?: string;
  priority?: TaskPriority;
  status?: Exclude<TaskStatus, 'DONE'>;
  progress?: number;
  plannedStartDate?: string;
  dueDate?: string;
}
export interface UpdatePlanTaskInput {
  ownerUserId?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
}
export interface CreateIssueInput {
  projectId: string;
  type: IssueType;
  title: string;
  description?: string;
  severity: IssueSeverity;
  ownerUserId?: string;
  dueDate?: string;
  probability?: number;
  impact?: number;
}
export interface UpdateIssueInput extends Partial<Omit<CreateIssueInput, 'projectId'>> {
  status?: Exclude<IssueStatus, 'RESOLVED' | 'CLOSED'>;
}

export interface MessageListQuery extends PageQuery {
  projectId?: string;
  status?: MessageStatus | '';
}
export interface CreateManualMessageInput {
  projectId?: string;
  senderName: string;
  content: string;
  receivedAt?: string;
}
export interface PendingActionDecisionInput {
  actionId: string;
  decision: 'CONFIRM' | 'REJECT';
  payload?: Record<string, unknown>;
}

export interface CreateSopTemplateInput {
  code: string;
  name: string;
  description?: string;
}
export interface CreateSopVersionInput {
  version: string;
  description?: string;
}
export interface CreateSopStageInput {
  name: string;
  description?: string;
  sortOrder?: number;
  defaultDurationDays: number;
}
export type UpdateSopStageInput = Partial<CreateSopStageInput>;
export interface CreateSopTaskInput extends CreateSopStageInput {
  required?: boolean;
  deliverableRequired?: boolean;
  deliverableName?: string;
  deliverableTemplate?: string;
}
export type UpdateSopTaskInput = Partial<CreateSopTaskInput>;
export interface CreateSopChecklistInput {
  name: string;
  sortOrder?: number;
  required?: boolean;
}

export interface DailyReportListQuery extends PageQuery {
  projectId?: string;
  dateFrom?: string;
  dateTo?: string;
}
export interface UpsertDailyReportInput {
  projectId: string;
  reportDate: string;
  completed: string[];
  risks: string[];
  coordination: string[];
  tomorrow: string[];
  notes?: string;
}
export interface GenerateWeeklyReportInput {
  projectId?: string;
  department?: string;
  weekStart: string;
  weekEnd: string;
}

export interface KnowledgeListQuery extends PageQuery {
  categoryId?: string;
  status?: KnowledgeStatus | '';
}
export interface CreateKnowledgeArticleInput {
  categoryId: string;
  title: string;
  summary?: string;
  content: string;
  tags?: string[];
  sourceProjectId?: string;
  sourceDocumentId?: string;
}
export type UpdateKnowledgeArticleInput = Partial<
  Pick<CreateKnowledgeArticleInput, 'categoryId' | 'title' | 'summary' | 'content' | 'tags'>
>;
export interface DepositDocumentInput {
  categoryId: string;
  title?: string;
}

export type UserStatus = 'ACTIVE' | 'DISABLED' | 'LOCKED' | 'DEPARTED';
export interface CreateUserInput {
  username: string;
  password: string;
  displayName: string;
  email?: string;
  roleCodes: string[];
}
export interface UpdateUserInput {
  displayName?: string;
  email?: string;
  status?: UserStatus;
  roleCodes?: string[];
}
export interface CreateRoleInput {
  code: string;
  name: string;
  description?: string;
  permissionCodes: string[];
}
export type UpdateRoleInput = Partial<Omit<CreateRoleInput, 'code'>>;
export interface AuditListQuery extends PageQuery {
  userId?: string;
  action?: string;
  resourceType?: string;
  dateFrom?: string;
  dateTo?: string;
}
