<script setup lang="ts">
import { computed, h, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { ElMessage, ElMessageBox } from 'element-plus';
import { projectsApi } from '../../api/projects.api';
import { tasksApi } from '../../api/tasks.api';
import { issuesApi } from '../../api/issues.api';
import { messagesApi } from '../../api/messages.api';
import { reportsApi } from '../../api/reports.api';
import { PERMISSIONS } from '@pmp/shared-constants';
import { useAuthStore } from '../../stores/auth';
import StatusTag from '../../components/StatusTag.vue';
import ApiErrorView from '../../components/ApiErrorView.vue';
import ProjectPlanPanel from './ProjectPlanPanel.vue';
import ProjectExecutionPanel from './ProjectExecutionPanel.vue';
import ProjectMembersPanel from './ProjectMembersPanel.vue';
import ProjectDocumentsPanel from './ProjectDocumentsPanel.vue';
import ProjectChangesPanel from './ProjectChangesPanel.vue';
import { projectQueryKey } from '../../composables/project-query';
import type { ProjectHealth } from '@pmp/shared-types';
import { ApiError } from '../../api/client';
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const projectId = computed(() => String(route.params.id));
const tab = ref(
  (typeof route.query.tab === 'string' && route.query.tab) ||
    sessionStorage.getItem(`pmp:project-tab:${projectId.value}`) ||
    'overview',
);
watch(projectId, (id) => {
  tab.value =
    (typeof route.query.tab === 'string' && route.query.tab) ||
    sessionStorage.getItem(`pmp:project-tab:${id}`) ||
    'overview';
});
const client = useQueryClient();
const editDialog = ref(false);
const editForm = reactive({
  name: '',
  customerName: '',
  description: '',
  managerUserId: '',
  approverUserId: '',
  plannedStartDate: '',
  plannedGoLiveDate: '',
  healthOverride: '' as ProjectHealth | '',
});
const project = useQuery({
  queryKey: projectQueryKey('project', projectId),
  queryFn: () => projectsApi.get(projectId.value),
});
const tasks = useQuery({
  queryKey: projectQueryKey('tasks', projectId),
  queryFn: () => tasksApi.list({ projectId: projectId.value, pageSize: 20 }),
});
const issues = useQuery({
  queryKey: projectQueryKey('issues', projectId),
  queryFn: () => issuesApi.list({ projectId: projectId.value, pageSize: 20 }),
});
const messages = useQuery({
  queryKey: projectQueryKey('messages', projectId),
  queryFn: () => messagesApi.list({ projectId: projectId.value, pageSize: 20 }),
});
const reports = useQuery({
  queryKey: projectQueryKey('daily-reports', projectId),
  queryFn: () => reportsApi.daily({ projectId: projectId.value }),
});
const lifecycle = useMutation({
  mutationFn: (action: 'start' | 'pause' | 'resume' | 'close') =>
    projectsApi.action(projectId.value, action),
  onSuccess: async () => {
    ElMessage.success('项目状态已更新');
    await client.invalidateQueries({ queryKey: ['project', projectId.value] });
    await client.invalidateQueries({ queryKey: ['projects'] });
  },
  onError: (error: Error) => showLifecycleError(error),
});
function showLifecycleError(error: Error): void {
  const details = error instanceof ApiError ? (error.details as Record<string, unknown>) : undefined;
  const deliverableBlockers = Array.isArray(details?.missingRequiredDeliverables)
    ? details.missingRequiredDeliverables
    : [];
  const documentBlockers = Array.isArray(details?.missingRequiredDocuments)
    ? details.missingRequiredDocuments
    : [];
  if (deliverableBlockers.length || documentBlockers.length) {
    const statusLabels: Record<string, string> = {
      NOT_SUBMITTED: '未上传',
      DRAFT: '草稿',
      PENDING_REVIEW: '待审核',
      REJECTED: '已驳回',
      NEEDS_REVISION: '需修订',
    };
    const children = [h('p', error.message)];
    if (deliverableBlockers.length) {
      children.push(h('strong', '计划必交资料'));
      children.push(
        h(
          'ul',
          deliverableBlockers.map((item) => {
            const blocker = item as {
              planTaskName: string;
              deliverableName: string;
              reason: string;
            };
            return h(
              'li',
              `${blocker.planTaskName} / ${blocker.deliverableName}：${statusLabels[blocker.reason] ?? blocker.reason}`,
            );
          }),
        ),
      );
    }
    if (documentBlockers.length) {
      children.push(h('strong', '普通必需文档'));
      children.push(
        h(
          'ul',
          documentBlockers.map((item) => {
            const blocker = item as { name: string; status: string };
            return h('li', `${blocker.name}：${statusLabels[blocker.status] ?? blocker.status}`);
          }),
        ),
      );
    }
    void ElMessageBox.alert(h('div', children), '项目暂不可结项', { type: 'warning' });
    return;
  }
  ElMessage.error(error.message);
}
async function action(value: 'start' | 'pause' | 'resume' | 'close'): Promise<void> {
  if (value === 'close')
    await ElMessageBox.confirm(
      '后端将校验计划任务、高优问题、必需普通文档、必交资料与待处理变更。',
      '确认项目结项',
      { type: 'warning' },
    );
  lifecycle.mutate(value);
}
function openEdit(): void {
  const value = project.data.value;
  if (!value) return;
  Object.assign(editForm, {
    name: value.name,
    customerName: value.customerName,
    description: value.description ?? '',
    managerUserId: value.managerUserId,
    approverUserId: value.approverUserId ?? '',
    plannedStartDate: value.plannedStartDate?.slice(0, 10) ?? '',
    plannedGoLiveDate: value.plannedGoLiveDate?.slice(0, 10) ?? '',
    healthOverride: value.health === value.derivedHealth ? '' : value.health,
  });
  editDialog.value = true;
}
async function saveProject(): Promise<void> {
  await projectsApi.update(projectId.value, {
    ...editForm,
    plannedStartDate: editForm.plannedStartDate || undefined,
    plannedGoLiveDate: editForm.plannedGoLiveDate || undefined,
    healthOverride: editForm.healthOverride || null,
  });
  editDialog.value = false;
  ElMessage.success('项目已更新');
  await client.invalidateQueries({ queryKey: ['project', projectId.value] });
  await client.invalidateQueries({ queryKey: ['projects'] });
}
async function removeProject(): Promise<void> {
  await ElMessageBox.confirm('删除后项目将从列表隐藏，进行中项目不能删除。', '删除项目', {
    type: 'warning',
  });
  await projectsApi.remove(projectId.value);
  ElMessage.success('项目已删除');
  await router.push('/projects');
}
function changeTab(value: string | number): void {
  sessionStorage.setItem(`pmp:project-tab:${projectId.value}`, String(value));
}
</script>
<template>
  <div>
    <el-skeleton v-if="project.isLoading.value" :rows="8" animated /><el-result
      v-else-if="project.isError.value"
      icon="error"
      title="项目加载失败"
    /><template v-else-if="project.data.value"
      ><section class="detail-hero">
        <div>
          <div>
            <el-tag effect="plain">{{ project.data.value.code }}</el-tag>
            <StatusTag :value="project.data.value.health" />
          </div>
          <h2>{{ project.data.value.name }}</h2>
          <div class="detail-meta">
            <span>客户：{{ project.data.value.customerName }}</span
            ><span>负责人：{{ project.data.value.manager.displayName }}</span
            ><span>审批人：{{ project.data.value.approver?.displayName ?? '未配置' }}</span
            ><span>计划上线：{{ project.data.value.plannedGoLiveDate?.slice(0, 10) ?? '-' }}</span>
          </div>
        </div>
        <div class="toolbar-actions">
          <el-button
            v-if="
              auth.has(PERMISSIONS.PROJECT_EDIT) &&
              !['COMPLETED', 'CANCELLED'].includes(project.data.value.status)
            "
            @click="openEdit"
            >编辑</el-button
          >
          <el-button
            v-if="auth.has(PERMISSIONS.PROJECT_DELETE) && project.data.value.status !== 'ACTIVE'"
            type="danger"
            plain
            @click="removeProject"
            >删除</el-button
          >
          <StatusTag :value="project.data.value.status" /><el-button
            v-if="
              project.data.value.status === 'NOT_STARTED' && auth.has(PERMISSIONS.PROJECT_START)
            "
            type="primary"
            @click="action('start')"
            >启动项目</el-button
          ><el-button
            v-if="project.data.value.status === 'ACTIVE' && auth.has(PERMISSIONS.PROJECT_PAUSE)"
            @click="action('pause')"
            >暂停</el-button
          ><el-button
            v-if="project.data.value.status === 'PAUSED' && auth.has(PERMISSIONS.PROJECT_PAUSE)"
            type="primary"
            @click="action('resume')"
            >恢复</el-button
          ><el-button
            v-if="
              ['ACTIVE', 'PAUSED'].includes(project.data.value.status) &&
              auth.has(PERMISSIONS.PROJECT_CLOSE)
            "
            type="success"
            @click="action('close')"
            >项目结项</el-button
          >
        </div>
      </section>
      <el-tabs v-model="tab" class="panel" style="padding: 0 16px 16px" @tab-change="changeTab"
        ><el-tab-pane label="概览" name="overview"
          ><div
            class="metric-grid"
            style="grid-template-columns: repeat(4, minmax(130px, 1fr)); padding-top: 8px"
          >
            <article class="metric-card">
              <div class="metric-label">项目进度</div>
              <div class="metric-value">{{ project.data.value.progress }}%</div>
              <el-progress :percentage="project.data.value.progress" :show-text="false" />
            </article>
            <article class="metric-card">
              <div class="metric-label">执行任务</div>
              <div class="metric-value">{{ project.data.value._count?.workItems ?? 0 }}</div>
            </article>
            <article class="metric-card">
              <div class="metric-label">问题风险</div>
              <div class="metric-value">{{ project.data.value._count?.issues ?? 0 }}</div>
            </article>
            <article class="metric-card">
              <div class="metric-label">项目成员</div>
              <div class="metric-value">{{ project.data.value.members?.length ?? 0 }}</div>
            </article>
          </div>
          <div class="panel-body">
            <h3>项目说明</h3>
            <p class="muted">{{ project.data.value.description || '暂无说明' }}</p>
          </div></el-tab-pane
        ><el-tab-pane label="执行中心" name="execution"
          ><ProjectExecutionPanel :project-id="projectId" /></el-tab-pane
        ><el-tab-pane label="实施计划" name="plan"
          ><ProjectPlanPanel :project-id="projectId" /></el-tab-pane
        ><el-tab-pane label="任务" name="tasks"
          ><ApiErrorView
            v-if="tasks.isError.value"
            :error="tasks.error.value"
            title="项目任务加载失败"
            @retry="tasks.refetch()" />
          <div v-else class="table-wrap">
            <el-table :data="tasks.data.value?.items ?? []"
              ><el-table-column prop="name" label="任务" min-width="200" /><el-table-column
                prop="owner.displayName"
                label="负责人"
                width="120" /><el-table-column label="状态" width="100"
                ><template #default="scope"
                  ><StatusTag :value="scope.row.status" /></template></el-table-column
              ><el-table-column prop="plannedEndDate" label="截止日期" width="120"
            /></el-table></div></el-tab-pane
        ><el-tab-pane label="问题风险" name="issues"
          ><ApiErrorView
            v-if="issues.isError.value"
            :error="issues.error.value"
            title="项目问题加载失败"
            @retry="issues.refetch()" />
          <div v-else class="table-wrap">
            <el-table :data="issues.data.value?.items ?? []"
              ><el-table-column prop="title" label="问题" min-width="200" /><el-table-column
                prop="type"
                label="类型"
                width="100" /><el-table-column label="等级" width="100"
                ><template #default="scope"
                  ><StatusTag :value="scope.row.severity" /></template></el-table-column
              ><el-table-column label="状态" width="100"
                ><template #default="scope"
                  ><StatusTag :value="scope.row.status" /></template></el-table-column
            ></el-table></div></el-tab-pane
        ><el-tab-pane label="交付物" name="documents"
          ><ProjectDocumentsPanel :project-id="projectId" /></el-tab-pane
        ><el-tab-pane label="项目变更" name="changes"
          ><ProjectChangesPanel :project-id="projectId" /></el-tab-pane
        ><el-tab-pane label="项目消息" name="messages"
          ><ApiErrorView
            v-if="messages.isError.value"
            :error="messages.error.value"
            title="项目消息加载失败"
            @retry="messages.refetch()" />
          <div v-else class="table-wrap">
            <el-table :data="messages.data.value?.items ?? []"
              ><el-table-column prop="receivedAt" label="时间" width="180" /><el-table-column
                prop="senderName"
                label="发送人"
                width="120" /><el-table-column
                prop="content"
                label="内容"
                min-width="300"
                show-overflow-tooltip /><el-table-column label="状态" width="120"
                ><template #default="scope"
                  ><StatusTag :value="scope.row.status" /></template></el-table-column
            ></el-table></div></el-tab-pane
        ><el-tab-pane label="日报周报" name="reports"
          ><ApiErrorView
            v-if="reports.isError.value"
            :error="reports.error.value"
            title="项目日报加载失败"
            @retry="reports.refetch()"
          />
          <div v-else class="table-wrap">
            <el-table :data="reports.data.value ?? []"
              ><el-table-column prop="reportDate" label="日期" width="130" /><el-table-column
                prop="reporter.displayName"
                label="汇报人"
                width="120"
              /><el-table-column label="已完成" min-width="260"
                ><template #default="scope">{{
                  Array.isArray(scope.row.completed) ? scope.row.completed.join('；') : '-'
                }}</template></el-table-column
              ></el-table
            >
          </div></el-tab-pane
        ><el-tab-pane label="项目成员" name="members"
          ><ProjectMembersPanel :project-id="projectId" /></el-tab-pane
        ><el-tab-pane label="操作日志" name="audit"
          ><el-empty
            description="项目写操作已记入全局审计日志，请在系统管理中检索" /></el-tab-pane></el-tabs
    ></template>
    <el-dialog v-model="editDialog" title="编辑项目" width="min(640px,94vw)" destroy-on-close
      ><el-form label-position="top"
        ><div class="content-grid">
          <el-form-item label="项目名称" required
            ><el-input v-model.trim="editForm.name" /></el-form-item
          ><el-form-item label="客户名称" required
            ><el-input v-model.trim="editForm.customerName" /></el-form-item
          ><el-form-item label="负责人"
            ><el-select v-model="editForm.managerUserId" style="width: 100%"
              ><el-option
                v-for="member in project.data.value?.members ?? []"
                :key="member.userId"
                :label="member.user.displayName"
                :value="member.userId" /></el-select></el-form-item
          ><el-form-item label="审批负责人"
            ><el-select v-model="editForm.approverUserId" style="width: 100%"
              ><el-option
                v-for="member in project.data.value?.members ?? []"
                :key="member.userId"
                :label="member.user.displayName"
                :value="member.userId" /></el-select></el-form-item
          ><el-form-item label="健康度覆盖"
            ><el-select v-model="editForm.healthOverride" clearable style="width: 100%"
              ><el-option label="自动计算" value="" /><el-option
                label="正常"
                value="NORMAL" /><el-option label="预警" value="WARNING" /><el-option
                label="高风险"
                value="HIGH_RISK" /></el-select></el-form-item
          ><el-form-item label="计划开始"
            ><el-date-picker
              v-model="editForm.plannedStartDate"
              type="date"
              value-format="YYYY-MM-DD"
              style="width: 100%" /></el-form-item
          ><el-form-item label="计划上线"
            ><el-date-picker
              v-model="editForm.plannedGoLiveDate"
              type="date"
              value-format="YYYY-MM-DD"
              style="width: 100%"
          /></el-form-item>
        </div>
        <el-form-item label="说明"
          ><el-input
            v-model="editForm.description"
            type="textarea"
            :rows="3" /></el-form-item></el-form
      ><template #footer
        ><el-button @click="editDialog = false">取消</el-button
        ><el-button
          type="primary"
          :disabled="!editForm.name || !editForm.customerName"
          @click="saveProject"
          >保存</el-button
        ></template
      ></el-dialog
    >
  </div>
</template>