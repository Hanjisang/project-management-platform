<script setup lang="ts">
import { computed, reactive, ref, toRef } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { ElMessage, ElMessageBox } from 'element-plus';
import { PERMISSIONS } from '@pmp/shared-constants';
import { projectChangesApi } from '../../api/project-changes.api';
import { projectsApi } from '../../api/projects.api';
import { useAuthStore } from '../../stores/auth';
import StatusTag from '../../components/StatusTag.vue';
import type {
  PlanStage,
  ProjectChangeRequest,
  ProjectDeliverable,
  ProjectWorkItem,
} from '../../types/domain';

const props = defineProps<{ projectId: string }>();
const projectId = toRef(props, 'projectId');
const auth = useAuthStore();
const client = useQueryClient();
const adjustmentDialog = ref(false);
const changeDialog = ref(false);
const impact = ref<{ classification: string; changeRate: number; reasons: string[] }>();
const detail = ref<ProjectChangeRequest>();
const detailDialog = ref(false);
const form = reactive({
  proposedCompletionDate: '',
  reason: '',
  title: '',
  description: '',
});

type OperationType =
  | 'ADD_STAGE'
  | 'CANCEL_STAGE'
  | 'ADD_WORK_ITEM'
  | 'CANCEL_WORK_ITEM'
  | 'ADD_CHECKLIST'
  | 'CANCEL_CHECKLIST'
  | 'ADD_DELIVERABLE'
  | 'CANCEL_DELIVERABLE'
  | 'CHANGE_ACCEPTANCE_CRITERIA';
type ApiOperationType = OperationType | 'PROJECT_COMPLETION_DATE_CHANGE';
type CriterionDraft = {
  id?: string;
  name: string;
  description?: string;
  required: boolean;
  weight: number;
};
type DraftOperation = {
  key: string;
  operationType: OperationType;
  entityId?: string;
  payload: Record<string, unknown>;
  label: string;
  criteria?: CriterionDraft[];
};
type ApiOperation = {
  operationType: ApiOperationType;
  entityId?: string;
  payload: Record<string, unknown>;
};

const operationType = ref<OperationType>('ADD_WORK_ITEM');
const targetStageId = ref('');
const targetWorkItemId = ref('');
const targetChecklistId = ref('');
const targetDeliverableId = ref('');
const operationName = ref('');
const operationRequired = ref(true);
const criteriaDraft = ref<CriterionDraft[]>([]);
const operations = ref<DraftOperation[]>([]);

const changes = useQuery({
  queryKey: computed(() => ['project-changes', projectId.value]),
  queryFn: () => projectChangesApi.list(projectId.value),
});
const execution = useQuery({
  queryKey: computed(() => ['project-execution', projectId.value]),
  queryFn: () =>
    projectsApi.execution(projectId.value) as Promise<{
      stages: PlanStage[];
    }>,
});
const stages = computed(() => execution.data.value?.stages ?? []);
const workItems = computed<ProjectWorkItem[]>(() => stages.value.flatMap((stage) => stage.workItems));
const checklistItems = computed(() =>
  workItems.value.flatMap((workItem) =>
    workItem.checklistItems.map((item) => ({ ...item, workItemName: workItem.name })),
  ),
);
const deliverables = computed<Array<ProjectDeliverable & { workItemName: string }>>(() =>
  workItems.value.flatMap((workItem) =>
    workItem.deliverables.map((deliverable) => ({ ...deliverable, workItemName: workItem.name })),
  ),
);

async function invalidateProjectExecution(): Promise<void> {
  await Promise.all([
    client.invalidateQueries({ queryKey: ['project', projectId.value] }),
    client.invalidateQueries({ queryKey: ['project-plan', projectId.value] }),
    client.invalidateQueries({ queryKey: ['project-execution', projectId.value] }),
    client.invalidateQueries({ queryKey: ['tasks'] }),
    client.invalidateQueries({ queryKey: ['dashboard'] }),
  ]);
}

function resetOperationEditor(): void {
  targetStageId.value = '';
  targetWorkItemId.value = '';
  targetChecklistId.value = '';
  targetDeliverableId.value = '';
  operationName.value = '';
  operationRequired.value = true;
  criteriaDraft.value = [];
}
function openChange(): void {
  operations.value = [];
  impact.value = undefined;
  resetOperationEditor();
  changeDialog.value = true;
}
function loadCriteria(deliverableId: string): void {
  const deliverable = deliverables.value.find((item) => item.id === deliverableId);
  criteriaDraft.value =
    deliverable?.reviewCriteria.map((criterion) => ({
      id: criterion.id,
      name: criterion.name,
      description: criterion.description,
      required: criterion.required,
      weight: criterion.weight,
    })) ?? [];
}
function addCriterion(): void {
  criteriaDraft.value.push({ name: '', required: true, weight: 0 });
}
function warn(message: string): void {
  ElMessage.warning(message);
}
function addOperation(): void {
  const key = `${Date.now()}-${Math.random()}`;
  const type = operationType.value;
  let operation: DraftOperation | undefined;
  if (type === 'ADD_STAGE') {
    if (!operationName.value.trim()) {
      warn('请输入阶段名称');
      return;
    }
    operation = {
      key,
      operationType: type,
      payload: { name: operationName.value.trim() },
      label: `新增阶段：${operationName.value.trim()}`,
    };
  } else if (type === 'CANCEL_STAGE') {
    const stage = stages.value.find((item) => item.id === targetStageId.value);
    if (!stage) {
      warn('请选择阶段');
      return;
    }
    operation = {
      key,
      operationType: type,
      entityId: stage.id,
      payload: {},
      label: `取消阶段：${stage.name}`,
    };
  } else if (type === 'ADD_WORK_ITEM') {
    const stage = stages.value.find((item) => item.id === targetStageId.value);
    if (!stage || !operationName.value.trim()) {
      warn('请选择阶段并填写任务名称');
      return;
    }
    operation = {
      key,
      operationType: type,
      payload: {
        planStageId: stage.id,
        name: operationName.value.trim(),
        required: operationRequired.value,
      },
      label: `新增任务：${stage.name} / ${operationName.value.trim()}`,
    };
  } else if (type === 'CANCEL_WORK_ITEM') {
    const item = workItems.value.find((entry) => entry.id === targetWorkItemId.value);
    if (!item) {
      warn('请选择任务');
      return;
    }
    operation = {
      key,
      operationType: type,
      entityId: item.id,
      payload: {},
      label: `取消任务：${item.name}`,
    };
  } else if (type === 'ADD_CHECKLIST') {
    const item = workItems.value.find((entry) => entry.id === targetWorkItemId.value);
    if (!item || !operationName.value.trim()) {
      warn('请选择任务并填写检查项名称');
      return;
    }
    operation = {
      key,
      operationType: type,
      payload: {
        workItemId: item.id,
        name: operationName.value.trim(),
        required: operationRequired.value,
      },
      label: `新增检查项：${item.name} / ${operationName.value.trim()}`,
    };
  } else if (type === 'CANCEL_CHECKLIST') {
    const item = checklistItems.value.find((entry) => entry.id === targetChecklistId.value);
    if (!item) {
      warn('请选择检查项');
      return;
    }
    operation = {
      key,
      operationType: type,
      entityId: item.id,
      payload: {},
      label: `取消检查项：${item.workItemName} / ${item.name}`,
    };
  } else if (type === 'ADD_DELIVERABLE') {
    const item = workItems.value.find((entry) => entry.id === targetWorkItemId.value);
    if (!item || !operationName.value.trim()) {
      warn('请选择任务并填写交付物名称');
      return;
    }
    operation = {
      key,
      operationType: type,
      payload: {
        workItemId: item.id,
        name: operationName.value.trim(),
        required: operationRequired.value,
        reviewMode: 'HUMAN_ONLY',
      },
      label: `新增交付物：${item.name} / ${operationName.value.trim()}`,
    };
  } else if (type === 'CANCEL_DELIVERABLE') {
    const item = deliverables.value.find((entry) => entry.id === targetDeliverableId.value);
    if (!item) {
      warn('请选择交付物');
      return;
    }
    operation = {
      key,
      operationType: type,
      entityId: item.id,
      payload: {},
      label: `取消交付物：${item.workItemName} / ${item.name}`,
    };
  } else if (type === 'CHANGE_ACCEPTANCE_CRITERIA') {
    const item = deliverables.value.find((entry) => entry.id === targetDeliverableId.value);
    const criteria = criteriaDraft.value.filter((criterion) => criterion.name.trim());
    if (!item || !criteria.length) {
      warn('请选择交付物并至少保留一条验收标准');
      return;
    }
    operation = {
      key,
      operationType: type,
      entityId: item.id,
      payload: {},
      criteria: criteria.map((criterion) => ({ ...criterion, name: criterion.name.trim() })),
      label: `调整验收标准：${item.workItemName} / ${item.name}（${criteria.length} 条）`,
    };
  }
  if (!operation) return;
  operations.value.push(operation);
  resetOperationEditor();
}
function removeOperation(key: string): void {
  operations.value = operations.value.filter((operation) => operation.key !== key);
}

async function classify(scopeChange = operations.value.length > 0): Promise<void> {
  impact.value = await projectChangesApi.preflight(projectId.value, {
    proposedCompletionDate: form.proposedCompletionDate || undefined,
    scopeChange,
  });
}
async function saveAdjustment(): Promise<void> {
  await projectChangesApi.adjust(projectId.value, {
    proposedCompletionDate: form.proposedCompletionDate,
    reason: form.reason,
  });
  adjustmentDialog.value = false;
  ElMessage.success('一般计划调整已直接生效并留档');
  await Promise.all([
    client.invalidateQueries({ queryKey: ['project-changes', projectId.value] }),
    invalidateProjectExecution(),
  ]);
}
function apiOperations(): ApiOperation[] {
  const structural: ApiOperation[] = operations.value.map((operation) => ({
    operationType: operation.operationType,
    entityId: operation.entityId,
    payload:
      operation.operationType === 'CHANGE_ACCEPTANCE_CRITERIA'
        ? {
            reason: JSON.stringify({
              reason: form.reason,
              criteria: operation.criteria ?? [],
            }),
          }
        : operation.payload,
  }));
  if (form.proposedCompletionDate)
    structural.unshift({
      operationType: 'PROJECT_COMPLETION_DATE_CHANGE',
      entityId: undefined,
      payload: { plannedCompletionDate: form.proposedCompletionDate },
    });
  return structural;
}
async function createChange(): Promise<void> {
  if (!form.proposedCompletionDate && !operations.value.length) {
    ElMessage.warning('请至少填写新的项目完成日期或添加一项结构化变更');
    return;
  }
  await classify(operations.value.length > 0);
  if (impact.value?.classification !== 'REQUIRES_CHANGE_REQUEST') {
    ElMessage.warning('当前仅涉及 ±20% 以内的总体完成时间调整，请使用“直接调整”');
    return;
  }
  await projectChangesApi.create(projectId.value, {
    title: form.title,
    description: form.description,
    changeType: operations.value.length
      ? form.proposedCompletionDate
        ? 'MIXED'
        : 'SCOPE'
      : 'SCHEDULE',
    reason: form.reason,
    source: 'INTERNAL_PRODUCT',
    operations: apiOperations(),
  });
  changeDialog.value = false;
  ElMessage.success('项目变更草稿已创建');
  await changes.refetch();
}
async function act(id: string, action: 'submit' | 'approve' | 'reject' | 'apply'): Promise<void> {
  let comment: string | undefined;
  if (action === 'reject')
    comment = (
      await ElMessageBox.prompt('请输入驳回原因', '驳回变更', {
        inputValidator: (value) => Boolean(value) || '请输入原因',
      })
    ).value;
  if (action === 'approve')
    comment = (await ElMessageBox.prompt('审批意见（可选）', '批准变更')).value;
  await projectChangesApi[action](id, comment);
  ElMessage.success('变更状态已更新');
  await Promise.all([changes.refetch(), invalidateProjectExecution()]);
}
async function showDetail(id: string): Promise<void> {
  detail.value = await projectChangesApi.get(id);
  detailDialog.value = true;
}
function ruleImpact(value?: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return { summary: value };
  }
}
function describeOperation(operation: {
  operationType: string;
  entityId?: string;
  payload: Record<string, unknown>;
}): string[] {
  const payload = operation.payload ?? {};
  if (operation.operationType === 'PROJECT_COMPLETION_DATE_CHANGE')
    return [`项目完成日期调整为 ${String(payload.plannedCompletionDate ?? '-')}`];
  if (operation.operationType === 'ADD_STAGE') return [`新增阶段：${String(payload.name ?? '-')}`];
  if (operation.operationType === 'ADD_WORK_ITEM') return [`新增任务：${String(payload.name ?? '-')}`];
  if (operation.operationType === 'ADD_CHECKLIST')
    return [`新增检查项：${String(payload.name ?? '-')}`];
  if (operation.operationType === 'ADD_DELIVERABLE')
    return [`新增交付物：${String(payload.name ?? '-')}`];
  if (operation.operationType === 'CANCEL_STAGE')
    return [
      `取消阶段：${stages.value.find((item) => item.id === operation.entityId)?.name ?? operation.entityId ?? '-'}`,
    ];
  if (operation.operationType === 'CANCEL_WORK_ITEM')
    return [
      `取消任务：${workItems.value.find((item) => item.id === operation.entityId)?.name ?? operation.entityId ?? '-'}`,
    ];
  if (operation.operationType === 'CANCEL_CHECKLIST')
    return [
      `取消检查项：${checklistItems.value.find((item) => item.id === operation.entityId)?.name ?? operation.entityId ?? '-'}`,
    ];
  if (operation.operationType === 'CANCEL_DELIVERABLE')
    return [
      `取消交付物：${deliverables.value.find((item) => item.id === operation.entityId)?.name ?? operation.entityId ?? '-'}`,
    ];
  if (operation.operationType === 'CHANGE_ACCEPTANCE_CRITERIA') {
    try {
      const value = JSON.parse(String(payload.reason ?? '{}')) as { criteria?: CriterionDraft[] };
      return [
        `调整验收标准：${deliverables.value.find((item) => item.id === operation.entityId)?.name ?? operation.entityId ?? '-'}`,
        ...(value.criteria ?? []).map(
          (criterion) => `• ${criterion.name}${criterion.required ? '（必需）' : ''}`,
        ),
      ];
    } catch {
      return ['调整验收标准'];
    }
  }
  return [operation.operationType];
}
</script>

<template>
  <div class="changes-panel">
    <div class="toolbar-actions">
      <el-button
        v-if="auth.has(PERMISSIONS.PROJECT_CHANGE_CREATE)"
        @click="adjustmentDialog = true"
        >直接调整</el-button
      >
      <el-button
        v-if="auth.has(PERMISSIONS.PROJECT_CHANGE_CREATE)"
        type="primary"
        @click="openChange"
        >创建项目变更</el-button
      >
    </div>
    <el-table :data="changes.data.value ?? []" v-loading="changes.isLoading.value">
      <el-table-column prop="code" label="编号" width="110" />
      <el-table-column prop="title" label="变更" min-width="220" />
      <el-table-column prop="changeType" label="类型" width="110" />
      <el-table-column prop="requestedBy.displayName" label="申请人" width="110" />
      <el-table-column prop="approver.displayName" label="审批人" width="110" />
      <el-table-column label="状态" width="130"
        ><template #default="scope"><StatusTag :value="scope.row.status" /></template
      ></el-table-column>
      <el-table-column label="操作" min-width="260"
        ><template #default="scope">
          <el-button link @click="showDetail(scope.row.id)">查看影响 / Diff</el-button>
          <el-button
            v-if="scope.row.status === 'DRAFT' && auth.has(PERMISSIONS.PROJECT_CHANGE_CREATE)"
            link
            type="primary"
            @click="act(scope.row.id, 'submit')"
            >提交</el-button
          >
          <el-button
            v-if="
              scope.row.status === 'PENDING_APPROVAL' &&
              auth.has(PERMISSIONS.PROJECT_CHANGE_APPROVE)
            "
            link
            type="success"
            @click="act(scope.row.id, 'approve')"
            >批准</el-button
          >
          <el-button
            v-if="
              scope.row.status === 'PENDING_APPROVAL' &&
              auth.has(PERMISSIONS.PROJECT_CHANGE_APPROVE)
            "
            link
            type="danger"
            @click="act(scope.row.id, 'reject')"
            >驳回</el-button
          >
          <el-button
            v-if="scope.row.status === 'APPROVED' && auth.has(PERMISSIONS.PROJECT_CHANGE_APPLY)"
            link
            type="primary"
            @click="act(scope.row.id, 'apply')"
            >应用</el-button
          >
        </template></el-table-column
      >
    </el-table>
    <el-empty
      v-if="!changes.isLoading.value && !changes.data.value?.length"
      description="暂无项目变更"
    />

    <el-dialog v-model="detailDialog" title="项目变更影响与 Diff" width="min(760px, 96vw)">
      <template v-if="detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="编号">{{ detail.code }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ detail.status }}</el-descriptions-item>
          <el-descriptions-item label="申请人">{{ detail.requestedBy.displayName }}</el-descriptions-item>
          <el-descriptions-item label="审批人">{{ detail.approver.displayName }}</el-descriptions-item>
          <el-descriptions-item label="原因" :span="2">{{ detail.reason }}</el-descriptions-item>
        </el-descriptions>
        <h4>规则影响分析</h4>
        <el-alert
          v-if="ruleImpact(detail.aiImpactSummary)"
          :title="String(ruleImpact(detail.aiImpactSummary)?.summary ?? '影响分析已生成')"
          :description="`${String(ruleImpact(detail.aiImpactSummary)?.scheduleImpact ?? '')}\n${String(ruleImpact(detail.aiImpactSummary)?.scopeImpact ?? '')}`"
          type="info"
          :closable="false"
          show-icon
        />
        <el-empty v-else description="暂无影响分析" />
        <h4>结构化变更</h4>
        <div v-for="operation in detail.operations ?? []" :key="operation.id" class="diff-card">
          <div v-for="line in describeOperation(operation)" :key="line">{{ line }}</div>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="adjustmentDialog" title="一般计划调整" width="min(520px, 94vw)">
      <el-alert
        title="系统始终相对最近批准基线计算；±20%（含边界）可直接生效，且会通知审批人并留档。"
        type="info"
        :closable="false"
      />
      <el-form label-position="top" style="margin-top: 16px">
        <el-form-item label="新的项目完成日期" required>
          <el-date-picker
            v-model="form.proposedCompletionDate"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 100%"
            @change="classify(false)"
          />
        </el-form-item>
        <el-form-item label="调整原因" required
          ><el-input v-model="form.reason" type="textarea"
        /></el-form-item>
        <el-tag
          v-if="impact"
          :type="impact.classification === 'DIRECT_ADJUSTMENT' ? 'success' : 'danger'"
          >{{ impact.classification }} · {{ impact.changeRate }}%</el-tag
        >
      </el-form>
      <template #footer>
        <el-button @click="adjustmentDialog = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="
            !form.proposedCompletionDate ||
            !form.reason ||
            impact?.classification !== 'DIRECT_ADJUSTMENT'
          "
          @click="saveAdjustment"
          >直接生效</el-button
        >
      </template>
    </el-dialog>

    <el-dialog v-model="changeDialog" title="创建项目变更" width="min(900px, 96vw)">
      <el-form label-position="top">
        <div class="content-grid">
          <el-form-item label="标题" required><el-input v-model="form.title" /></el-form-item>
          <el-form-item label="拟议完成日期"
            ><el-date-picker
              v-model="form.proposedCompletionDate"
              type="date"
              value-format="YYYY-MM-DD"
              style="width: 100%"
          /></el-form-item>
        </div>
        <el-form-item label="变更说明" required
          ><el-input v-model="form.description" type="textarea" :rows="2"
        /></el-form-item>
        <el-form-item label="原因" required
          ><el-input v-model="form.reason" type="textarea" :rows="2"
        /></el-form-item>

        <section class="operation-builder">
          <div class="section-head">
            <strong>结构化变更项</strong
            ><span class="muted">范围变化会自动进入审批，不由用户手工判断</span>
          </div>
          <el-select v-model="operationType" style="width: 220px" @change="resetOperationEditor">
            <el-option label="新增阶段" value="ADD_STAGE" />
            <el-option label="取消阶段" value="CANCEL_STAGE" />
            <el-option label="新增任务" value="ADD_WORK_ITEM" />
            <el-option label="取消任务" value="CANCEL_WORK_ITEM" />
            <el-option label="新增检查项" value="ADD_CHECKLIST" />
            <el-option label="取消检查项" value="CANCEL_CHECKLIST" />
            <el-option label="新增交付物" value="ADD_DELIVERABLE" />
            <el-option label="取消交付物" value="CANCEL_DELIVERABLE" />
            <el-option label="调整验收标准" value="CHANGE_ACCEPTANCE_CRITERIA" />
          </el-select>

          <div class="operation-fields">
            <el-select
              v-if="['CANCEL_STAGE', 'ADD_WORK_ITEM'].includes(operationType)"
              v-model="targetStageId"
              placeholder="选择阶段"
              filterable
            >
              <el-option
                v-for="stage in stages"
                :key="stage.id"
                :label="stage.name"
                :value="stage.id"
              />
            </el-select>
            <el-select
              v-if="
                ['CANCEL_WORK_ITEM', 'ADD_CHECKLIST', 'ADD_DELIVERABLE'].includes(operationType)
              "
              v-model="targetWorkItemId"
              placeholder="选择任务"
              filterable
            >
              <el-option
                v-for="item in workItems"
                :key="item.id"
                :label="`${item.stage?.name ?? '-'} / ${item.name}`"
                :value="item.id"
              />
            </el-select>
            <el-select
              v-if="operationType === 'CANCEL_CHECKLIST'"
              v-model="targetChecklistId"
              placeholder="选择检查项"
              filterable
            >
              <el-option
                v-for="item in checklistItems"
                :key="item.id"
                :label="`${item.workItemName} / ${item.name}`"
                :value="item.id"
              />
            </el-select>
            <el-select
              v-if="['CANCEL_DELIVERABLE', 'CHANGE_ACCEPTANCE_CRITERIA'].includes(operationType)"
              v-model="targetDeliverableId"
              placeholder="选择交付物"
              filterable
              @change="
                operationType === 'CHANGE_ACCEPTANCE_CRITERIA' && loadCriteria(String($event))
              "
            >
              <el-option
                v-for="item in deliverables"
                :key="item.id"
                :label="`${item.workItemName} / ${item.name}`"
                :value="item.id"
              />
            </el-select>
            <el-input
              v-if="
                ['ADD_STAGE', 'ADD_WORK_ITEM', 'ADD_CHECKLIST', 'ADD_DELIVERABLE'].includes(
                  operationType,
                )
              "
              v-model="operationName"
              placeholder="名称"
            />
            <el-checkbox
              v-if="['ADD_WORK_ITEM', 'ADD_CHECKLIST', 'ADD_DELIVERABLE'].includes(operationType)"
              v-model="operationRequired"
              >必需项</el-checkbox
            >
          </div>

          <div v-if="operationType === 'CHANGE_ACCEPTANCE_CRITERIA'" class="criteria-editor">
            <div
              v-for="(criterion, index) in criteriaDraft"
              :key="criterion.id ?? index"
              class="criterion-row"
            >
              <el-input v-model="criterion.name" placeholder="验收标准" />
              <el-checkbox v-model="criterion.required">必需</el-checkbox>
              <el-input-number
                v-model="criterion.weight"
                :min="0"
                :max="100"
                controls-position="right"
              />
              <el-button link type="danger" @click="criteriaDraft.splice(index, 1)"
                >删除</el-button
              >
            </div>
            <el-button link type="primary" @click="addCriterion">+ 新增标准</el-button>
          </div>
          <el-button type="primary" plain @click="addOperation">加入变更项</el-button>
        </section>

        <div v-if="operations.length" class="operation-list">
          <div v-for="operation in operations" :key="operation.key" class="operation-row">
            <span>{{ operation.label }}</span>
            <el-button link type="danger" @click="removeOperation(operation.key)">移除</el-button>
          </div>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="changeDialog = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="!form.title || !form.description || !form.reason"
          @click="createChange"
          >创建草稿</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.changes-panel {
  padding-top: 8px;
}
.toolbar-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-bottom: 14px;
}
.diff-card {
  margin-top: 10px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-subtle);
}
.operation-builder {
  margin-top: 16px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-muted);
}
.section-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.operation-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 12px 0;
}
.criteria-editor {
  margin: 12px 0;
}
.criterion-row {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) 80px 140px 60px;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.operation-list {
  margin-top: 14px;
}
.operation-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  margin-top: 6px;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.muted {
  color: var(--text-muted);
  font-size: 12px;
}
@media (max-width: 760px) {
  .operation-fields {
    grid-template-columns: 1fr;
  }
  .criterion-row {
    grid-template-columns: 1fr;
  }
  .section-head {
    flex-direction: column;
  }
}
</style>
