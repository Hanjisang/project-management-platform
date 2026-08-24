<script setup lang="ts">
import { computed, ref, toRef } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { ElMessage, ElMessageBox } from 'element-plus';
import { PERMISSIONS } from '@pmp/shared-constants';
import { projectsApi } from '../../api/projects.api';
import { sopApi } from '../../api/sop.api';
import { useAuthStore } from '../../stores/auth';
import { ApiError } from '../../api/client';
import { projectQueryKey } from '../../composables/project-query';
import StatusTag from '../../components/StatusTag.vue';
import TaskExecutionDrawer from '../tasks/TaskExecutionDrawer.vue';
import type { ProjectWorkItem } from '../../types/domain';

const props = defineProps<{ projectId: string }>();
const projectId = toRef(props, 'projectId');
const auth = useAuthStore();
const client = useQueryClient();
const selectedVersion = ref('');
const syncDialog = ref(false);
const drawer = ref(false);
const selectedTaskId = ref('');
const preview = ref<{
  diff: Array<{ operation: string; entity: string; path: string }>;
  diffHash: string;
} | null>(null);

const plan = useQuery({
  queryKey: projectQueryKey('project-plan', projectId),
  queryFn: () => projectsApi.plan(projectId.value),
  retry: false,
});
const planMissing = computed(
  () => plan.error.value instanceof ApiError && plan.error.value.code === 'PROJECT_PLAN_NOT_FOUND',
);
const templates = useQuery({ queryKey: ['sop-templates'], queryFn: sopApi.list });
const generate = useMutation({
  mutationFn: () => projectsApi.generatePlan(projectId.value, selectedVersion.value),
  onSuccess: async () => {
    ElMessage.success('实施计划已生成');
    await Promise.all([
      client.invalidateQueries({ queryKey: ['project-plan', projectId.value] }),
      client.invalidateQueries({ queryKey: ['project-execution', projectId.value] }),
      client.invalidateQueries({ queryKey: ['tasks'] }),
    ]);
  },
  onError: (error: Error) => ElMessage.error(error.message),
});

async function showSync(): Promise<void> {
  if (!selectedVersion.value) return;
  try {
    preview.value = (await projectsApi.syncPreview(
      projectId.value,
      selectedVersion.value,
    )) as typeof preview.value;
    syncDialog.value = true;
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}
async function applySync(): Promise<void> {
  if (!preview.value) return;
  await ElMessageBox.confirm(
    '直接同步仅适用于未启动、无人工/变更任务且没有执行记录的项目。存在自定义执行数据时系统会拒绝同步，避免数据丢失。确定继续？',
    '确认 SOP 同步',
    { type: 'warning' },
  );
  try {
    await projectsApi.syncPlan(projectId.value, selectedVersion.value, preview.value.diffHash);
    ElMessage.success('SOP 同步已应用');
    syncDialog.value = false;
    await Promise.all([
      client.invalidateQueries({ queryKey: ['project-plan', projectId.value] }),
      client.invalidateQueries({ queryKey: ['project-execution', projectId.value] }),
      client.invalidateQueries({ queryKey: ['tasks'] }),
      client.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}
async function toggleChecklist(id: string, completed: unknown): Promise<void> {
  try {
    await projectsApi.completeChecklist(id, Boolean(completed));
    await Promise.all([
      client.invalidateQueries({ queryKey: ['project-plan', projectId.value] }),
      client.invalidateQueries({ queryKey: ['project-execution', projectId.value] }),
      client.invalidateQueries({ queryKey: ['project', projectId.value] }),
      client.invalidateQueries({ queryKey: ['tasks'] }),
      client.invalidateQueries({ queryKey: ['task-detail'] }),
      client.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}
function openTask(task: ProjectWorkItem): void {
  selectedTaskId.value = task.id;
  drawer.value = true;
}
</script>

<template>
  <div>
    <div class="filters plan-toolbar">
      <div>
        <strong>计划结构</strong>
        <p class="muted">SOP 负责生成计划结构；检查项可在计划中直接执行，完整任务与交付物在任务抽屉处理。</p>
      </div>
      <div class="filter-row">
        <el-select
          v-model="selectedVersion"
          filterable
          placeholder="选择已发布 SOP 版本"
          style="width: 360px"
        >
          <template v-for="template in templates.data.value ?? []" :key="template.id">
            <el-option
              v-for="version in template.versions.filter((item) => item.status === 'PUBLISHED')"
              :key="version.id"
              :label="`${template.name} · ${version.version}`"
              :value="version.id"
            />
          </template>
        </el-select>
        <el-button
          v-if="!plan.data.value && auth.has(PERMISSIONS.PLAN_EDIT)"
          type="primary"
          :disabled="!selectedVersion"
          :loading="generate.isPending.value"
          @click="generate.mutate()"
        >生成计划</el-button>
        <el-button
          v-else-if="plan.data.value && auth.has(PERMISSIONS.PLAN_EDIT)"
          :disabled="!selectedVersion || selectedVersion === plan.data.value.sourceSopVersionId"
          @click="showSync"
        >预览 SOP 同步</el-button>
      </div>
    </div>

    <el-result
      v-if="plan.isError.value && planMissing"
      icon="info"
      title="尚未生成实施计划"
      sub-title="可以先创建人工任务；选择已发布 SOP 后再生成正式计划结构"
    />
    <el-result
      v-else-if="plan.isError.value"
      icon="error"
      :title="
        plan.error.value instanceof ApiError && plan.error.value.code === 'PERMISSION_DENIED'
          ? '无权查看实施计划'
          : '实施计划加载失败'
      "
    >
      <template #extra><el-button @click="plan.refetch()">重试</el-button></template>
    </el-result>

    <div v-else-if="plan.data.value">
      <div class="plan-summary">
        <strong>{{ plan.data.value.name }}</strong>
        <span>整体进度 {{ plan.data.value.progress }}%</span>
      </div>
      <article v-for="stage in plan.data.value.stages" :key="stage.id" class="plan-stage">
        <div class="plan-stage-header">
          <div>
            <strong>{{ stage.name }}</strong>
            <span class="muted"> · 权重 {{ stage.weight }}%</span>
          </div>
          <el-progress :percentage="stage.progress" style="width: min(260px, 45%)" />
        </div>
        <div v-for="task in stage.workItems" :key="task.id" class="plan-task compact-task">
          <div>
            <strong>{{ task.name }}</strong>
            <div class="muted task-meta">
              {{ task.owner?.displayName ?? '未分配' }} ·
              {{ task.plannedStartDate?.slice(0, 10) ?? '-' }} 至
              {{ task.plannedEndDate?.slice(0, 10) ?? '-' }}
            </div>
          </div>
          <span>检查项 {{ task.checklistSummary?.completed ?? 0 }}/{{ task.checklistSummary?.total ?? 0 }}</span>
          <span>交付物 {{ task.deliverableSummary?.approved ?? 0 }}/{{ task.deliverableSummary?.total ?? 0 }}</span>
          <el-progress :percentage="task.progress" :stroke-width="7" />
          <StatusTag :value="task.status" />
          <el-button link type="primary" @click="openTask(task)">打开任务</el-button>
          <div v-if="task.checklistItems.length" class="checklist-inline">
            <el-checkbox
              v-for="item in task.checklistItems"
              :key="item.id"
              :model-value="item.completed"
              :disabled="!auth.has(PERMISSIONS.TASK_EDIT)"
              @change="toggleChecklist(item.id, $event)"
            >
              {{ item.name }}<span v-if="item.required" class="required-mark"> *</span>
            </el-checkbox>
          </div>
        </div>
      </article>
    </div>

    <el-dialog v-model="syncDialog" title="SOP 同步差异" width="min(760px,95vw)">
      <el-alert
        title="未启动项目可直接同步；如存在人工/变更任务或执行记录，后端会拒绝破坏性同步。已启动项目必须走项目变更。"
        type="info"
        :closable="false"
        style="margin-bottom: 12px"
      />
      <el-table :data="preview?.diff ?? []" max-height="480">
        <el-table-column prop="operation" label="操作" width="100" />
        <el-table-column prop="entity" label="对象" width="110" />
        <el-table-column prop="path" label="路径" min-width="260" />
      </el-table>
      <el-empty v-if="preview && !preview.diff.length" description="两个版本无差异" />
      <template #footer>
        <el-button @click="syncDialog = false">取消</el-button>
        <el-button type="primary" :disabled="!preview?.diff.length" @click="applySync">确认应用</el-button>
      </template>
    </el-dialog>

    <TaskExecutionDrawer v-model="drawer" :task-id="selectedTaskId" />
  </div>
</template>

<style scoped>
.plan-toolbar,
.plan-summary,
.plan-stage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.plan-toolbar { margin-bottom: 14px; }
.plan-toolbar p { margin: 4px 0 0; }
.plan-summary { margin-bottom: 12px; }
.plan-stage { margin-bottom: 14px; padding: 14px; border: 1px solid var(--border); border-radius: 10px; }
.plan-stage-header { margin-bottom: 10px; }
.compact-task {
  display: grid;
  grid-template-columns: minmax(220px, 2fr) 120px 110px minmax(120px, 1fr) 100px 80px;
  gap: 12px;
  align-items: center;
  padding: 10px 0;
  border-top: 1px solid var(--border);
}
.checklist-inline {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
}
.checklist-inline .el-checkbox { margin-right: 0; }
.required-mark { color: var(--el-color-danger); }
.task-meta { margin-top: 4px; font-size: 12px; }
.muted { color: var(--el-text-color-secondary); }
@media (max-width: 900px) {
  .plan-toolbar { align-items: flex-start; flex-direction: column; }
  .compact-task { grid-template-columns: 1fr 100px; }
  .compact-task > span,
  .compact-task > .el-progress { display: none; }
  .checklist-inline { grid-column: 1 / -1; }
}
</style>
