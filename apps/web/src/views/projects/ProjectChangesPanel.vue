<script setup lang="ts">
import { computed, reactive, ref, toRef } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { ElMessage, ElMessageBox } from 'element-plus';
import { PERMISSIONS } from '@pmp/shared-constants';
import { projectChangesApi } from '../../api/project-changes.api';
import { useAuthStore } from '../../stores/auth';
import StatusTag from '../../components/StatusTag.vue';

const props = defineProps<{ projectId: string }>();
const projectId = toRef(props, 'projectId');
const auth = useAuthStore();
const client = useQueryClient();
const adjustmentDialog = ref(false);
const changeDialog = ref(false);
const impact = ref<{ classification: string; changeRate: number; reasons: string[] }>();
const detail = ref<import('../../types/domain').ProjectChangeRequest>();
const detailDialog = ref(false);
const form = reactive({
  proposedCompletionDate: '',
  reason: '',
  title: '',
  description: '',
  scopeChange: false,
});
const changes = useQuery({
  queryKey: computed(() => ['project-changes', projectId.value]),
  queryFn: () => projectChangesApi.list(projectId.value),
});

async function invalidateProjectExecution(): Promise<void> {
  await Promise.all([
    client.invalidateQueries({ queryKey: ['project', projectId.value] }),
    client.invalidateQueries({ queryKey: ['project-plan', projectId.value] }),
    client.invalidateQueries({ queryKey: ['project-execution', projectId.value] }),
    client.invalidateQueries({ queryKey: ['tasks'] }),
    client.invalidateQueries({ queryKey: ['dashboard'] }),
  ]);
}

async function classify(): Promise<void> {
  impact.value = await projectChangesApi.preflight(projectId.value, {
    proposedCompletionDate: form.proposedCompletionDate || undefined,
    scopeChange: form.scopeChange,
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
async function createChange(): Promise<void> {
  await classify();
  if (impact.value?.classification !== 'REQUIRES_CHANGE_REQUEST') {
    ElMessage.warning('当前影响属于一般调整，请使用“直接调整”');
    return;
  }
  await projectChangesApi.create(projectId.value, {
    title: form.title,
    description: form.description,
    changeType: form.scopeChange ? 'SCOPE' : 'SCHEDULE',
    reason: form.reason,
    source: 'INTERNAL_PRODUCT',
    operations: form.proposedCompletionDate
      ? [
          {
            operationType: 'PROJECT_COMPLETION_DATE_CHANGE',
            payload: { plannedCompletionDate: form.proposedCompletionDate },
          },
        ]
      : [],
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
function aiImpact(value?: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return { summary: value };
  }
}
</script>

<template>
  <div class="changes-panel">
    <div class="toolbar-actions">
      <el-button v-if="auth.has(PERMISSIONS.PROJECT_CHANGE_CREATE)" @click="adjustmentDialog = true"
        >直接调整</el-button
      >
      <el-button
        v-if="auth.has(PERMISSIONS.PROJECT_CHANGE_CREATE)"
        type="primary"
        @click="changeDialog = true"
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
      <el-table-column label="操作" min-width="240"
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
          <el-descriptions-item label="申请人">{{
            detail.requestedBy.displayName
          }}</el-descriptions-item>
          <el-descriptions-item label="审批人">{{
            detail.approver.displayName
          }}</el-descriptions-item>
          <el-descriptions-item label="原因" :span="2">{{ detail.reason }}</el-descriptions-item>
        </el-descriptions>
        <h4>AI / 规则影响分析</h4>
        <el-alert
          v-if="aiImpact(detail.aiImpactSummary)"
          :title="String(aiImpact(detail.aiImpactSummary)?.summary ?? '影响分析已生成')"
          :description="`${String(aiImpact(detail.aiImpactSummary)?.scheduleImpact ?? '')}\n${String(aiImpact(detail.aiImpactSummary)?.scopeImpact ?? '')}`"
          :type="aiImpact(detail.aiImpactSummary)?.status === 'FAILED' ? 'warning' : 'info'"
          :closable="false"
          show-icon
        />
        <el-empty v-else description="暂无影响分析" />
        <h4>结构化变更 Diff</h4>
        <div v-for="operation in detail.operations ?? []" :key="operation.id" class="diff-card">
          <strong>{{ operation.operationType }}</strong>
          <small v-if="operation.entityId">对象：{{ operation.entityId }}</small>
          <pre>{{ JSON.stringify(operation.payload, null, 2) }}</pre>
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
        <el-form-item label="新的项目完成日期" required
          ><el-date-picker
            v-model="form.proposedCompletionDate"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 100%"
            @change="classify"
        /></el-form-item>
        <el-form-item label="调整原因" required
          ><el-input v-model="form.reason" type="textarea"
        /></el-form-item>
        <el-tag
          v-if="impact"
          :type="impact.classification === 'DIRECT_ADJUSTMENT' ? 'success' : 'danger'"
          >{{ impact.classification }} · {{ impact.changeRate }}%</el-tag
        >
      </el-form>
      <template #footer
        ><el-button @click="adjustmentDialog = false">取消</el-button
        ><el-button
          type="primary"
          :disabled="
            !form.proposedCompletionDate ||
            !form.reason ||
            impact?.classification !== 'DIRECT_ADJUSTMENT'
          "
          @click="saveAdjustment"
          >直接生效</el-button
        ></template
      >
    </el-dialog>

    <el-dialog v-model="changeDialog" title="创建项目变更" width="min(620px, 94vw)">
      <el-form label-position="top">
        <el-form-item label="标题" required><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="变更说明" required
          ><el-input v-model="form.description" type="textarea" :rows="3"
        /></el-form-item>
        <el-form-item label="原因" required
          ><el-input v-model="form.reason" type="textarea"
        /></el-form-item>
        <el-form-item label="拟议完成日期"
          ><el-date-picker
            v-model="form.proposedCompletionDate"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 100%"
        /></el-form-item>
        <el-checkbox v-model="form.scopeChange">涉及正式范围变化（始终需要审批）</el-checkbox>
      </el-form>
      <template #footer
        ><el-button @click="changeDialog = false">取消</el-button
        ><el-button
          type="primary"
          :disabled="!form.title || !form.description || !form.reason"
          @click="createChange"
          >创建草稿</el-button
        ></template
      >
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
.diff-card small {
  display: block;
  margin-top: 4px;
  color: var(--text-muted);
}
.diff-card pre {
  overflow: auto;
  margin: 8px 0 0;
  white-space: pre-wrap;
}
</style>
