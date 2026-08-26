import type {
  DocumentStatus,
  IssueSeverity,
  IssueStatus,
  IssueType,
  KnowledgeStatus,
  MessageStatus,
  Paginated,
  ProjectHealth,
  ProjectRole,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
} from '@pmp/shared-types';
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
  approverUserId?: string;
  approver?: UserRef;
  status: ProjectStatus;
  health: ProjectHealth;
  derivedHealth?: ProjectHealth;
  effectiveHealth?: ProjectHealth;
  progress: number;
  plannedStartDate?: string;
  plannedGoLiveDate?: string;
  actualStartDate?: string;
  description?: string;
  _count?: {
    members: number;
    workItems: number;
    issues: number;
    documents?: number;
    messages?: number;
  };
  members?: ProjectMember[];
  plans?: Array<{ id: string; sourceVersion?: { version: string; template: { name: string } } }>;
}
export interface ProjectMember {
  projectId: string;
  userId: string;
  projectRole: ProjectRole;
  user: UserRef & { status?: string };
}
export interface ChecklistItem {
  id: string;
  name: string;
  completed: boolean;
  required: boolean;
}
export interface ProjectWorkItem {
  id: string;
  projectId: string;
  planStageId: string;
  parentWorkItemId?: string;
  name: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  weight: number;
  required: boolean;
  sourceType: 'SOP' | 'MANUAL' | 'MESSAGE' | 'ISSUE' | 'ZENTAO' | 'CHANGE';
  sourceId?: string;
  isCustom: boolean;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  project: Pick<Project, 'id' | 'code' | 'name'>;
  stage: { id: string; name: string; planId: string };
  owner?: UserRef;
  checklistItems: ChecklistItem[];
  deliverables: ProjectDeliverable[];
  children?: ProjectWorkItem[];
  checklistSummary?: { completed: number; total: number };
  deliverableSummary?: { approved: number; total: number };
  zentaoSync?: { syncStatus: string; externalTaskId?: string };
}
export interface DeliverableTemplateFile {
  id: string;
  fileName: string;
  mimeType: string;
  size: string;
  checksum: string;
  createdAt: string;
}
export interface ProjectDeliverable {
  id: string;
  name: string;
  description?: string;
  required: boolean;
  sortOrder: number;
  isCustom: boolean;
  reviewMode: 'AI_WITH_HUMAN_OVERRIDE' | 'AI_THEN_HUMAN_REQUIRED' | 'HUMAN_ONLY';
  needsRevision: boolean;
  effectiveStatus:
    | 'NOT_SUBMITTED'
    | 'AI_PENDING'
    | 'AI_REJECTED'
    | 'HUMAN_REVIEW_REQUIRED'
    | 'REJECTED'
    | 'APPROVED'
    | 'NEEDS_REVISION'
    | 'AI_FAILED';
  progressContribution?: 0 | 0.5 | 1;
  templates: DeliverableTemplateFile[];
  reviewCriteria: Array<{
    id: string;
    name: string;
    description?: string;
    required: boolean;
    weight: number;
  }>;
  documents: DocumentRecord[];
}
export interface PlanStage {
  id: string;
  name: string;
  progress: number;
  weight: number;
  plannedStartDate?: string;
  plannedEndDate?: string;
  workItems: ProjectWorkItem[];
}
export interface ProjectPlan {
  id: string;
  name: string;
  progress: number;
  sourceSopVersionId?: string;
  stages: PlanStage[];
  sourceVersion?: { version: string; template: { name: string } };
}
export type Task = ProjectWorkItem;
export type PlanTask = ProjectWorkItem;
export interface Issue {
  id: string;
  projectId: string;
  type: IssueType;
  title: string;
  description?: string;
  severity: IssueSeverity;
  status: IssueStatus;
  riskScore?: number;
  probability?: number;
  impact?: number;
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
  status: DocumentStatus;
  workItem?: { id: string; name: string; stage?: { id: string; name: string } };
  projectDeliverable?: {
    id: string;
    name: string;
    workItem: { id: string; name: string; stage: { id: string; name: string } };
  };
  versions: Array<{
    id: string;
    version: string;
    fileName: string;
    mimeType: string;
    size: string;
    createdAt: string;
    reviews: Array<{
      id: string;
      reviewType: 'AI' | 'HUMAN';
      status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FAILED';
      score?: number;
      summary?: string;
      decisionReason?: string;
      reviewer?: UserRef;
      findings: Array<{
        id: string;
        severity: string;
        title: string;
        description: string;
        suggestion?: string;
      }>;
      criterionResults: Array<{
        id: string;
        criterionId: string;
        passed: boolean;
        score?: number;
        explanation?: string;
      }>;
    }>;
  }>;
}
export interface PendingAction {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'EXECUTED' | 'FAILED';
  resultResourceId?: string;
}
export interface MessageRecord {
  id: string;
  projectId?: string;
  source: string;
  senderName: string;
  content: string;
  receivedAt: string;
  status: MessageStatus;
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
  status: 'DRAFT' | 'PUBLISHED';
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
      checklistItems: Array<{ id: string; name: string; required: boolean }>;
      deliverables: Array<{
        id: string;
        stableKey: string;
        name: string;
        description?: string;
        required: boolean;
        sortOrder: number;
        reviewMode: 'AI_WITH_HUMAN_OVERRIDE' | 'AI_THEN_HUMAN_REQUIRED' | 'HUMAN_ONLY';
        aiAutoApproveThreshold?: number;
        aiReviewInstruction?: string;
        templates: DeliverableTemplateFile[];
        reviewCriteria: Array<{
          id: string;
          name: string;
          description?: string;
          required: boolean;
          weight: number;
          sortOrder: number;
        }>;
      }>;
    }>;
  }>;
}
export interface KnowledgeArticle {
  id: string;
  title: string;
  summary?: string;
  content: string;
  status: KnowledgeStatus;
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

export interface ProjectChangeRequest {
  id: string;
  projectId: string;
  code: string;
  title: string;
  description: string;
  changeType: string;
  reason: string;
  source: string;
  status:
    | 'DRAFT'
    | 'ANALYZING'
    | 'PENDING_APPROVAL'
    | 'APPROVED'
    | 'REJECTED'
    | 'APPLYING'
    | 'APPLIED'
    | 'CANCELLED'
    | 'FAILED';
  requestedBy: UserRef;
  approver: UserRef;
  approvalComment?: string;
  aiImpactSummary?: string | null;
  operations?: Array<{
    id: string;
    operationType: string;
    entityId?: string;
    payload: Record<string, unknown>;
    appliedAt?: string;
  }>;
  _count?: { operations: number };
  baseline?: { id: string; version: number } | null;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  projectId?: string | null;
  type: string;
  title: string;
  content: string;
  resourceType?: string;
  resourceId?: string;
  readAt?: string | null;
  createdAt: string;
}
