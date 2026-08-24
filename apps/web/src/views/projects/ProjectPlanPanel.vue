<script setup lang="ts">
import { computed, ref, toRef } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { ElMessage, ElMessageBox } from 'element-plus';
import { projectsApi } from '../../api/projects.api';
import { sopApi } from '../../api/sop.api';
import StatusTag from '../../components/StatusTag.vue';
import { PERMISSIONS } from '@pmp/shared-constants';
import { useAuthStore } from '../../stores/auth';
import { ApiError } from '../../api/client';
import { projectQueryKey } from '../../composables/project-query';
import type { PlanTask } from '../../types/domain';
const props = defineProps<{ projectId: string }>();
const projectId = toRef(props, 'projectId');
const auth = useAuthStore();
const client = useQueryClient();
const selectedVersion = ref('');
const syncDialog = ref(false);
const taskDialog = ref(false);
const editingTaskId = ref('');
const taskForm = ref({ ownerUserId: '', plannedStartDate: '', plannedEndDate: '' });
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
const members = useQuery({
  queryKey: projectQueryKey('project-members', projectId),
  queryFn: () => projectsApi.members(projectId.value),
});
const generate = useMutation({
  mutationFn: () => projectsApi.generatePlan(projectId.value, selectedVersion.value),
  onSuccess: async () => {
    ElMessage.success('实施计划已生成');
    await client.invalidateQueries({ queryKey: ['project-plan', projectId.value] });
  },
  onError: (error: Error) => ElMessage.error(error.message),
});
const complete = useMutation({
  mutationFn: ({ id, value }: { id: string; value: boolean }) =>
    projectsApi.completeChecklist(id, value),
  onSuccess: async () => {
    await client.invalidateQueries({ queryKey: ['project-plan', projectId.value] });
    await client.invalidateQueries({ queryKey: ['project', projectId.value] });
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
  await ElMessageBox.confirm('同步会更新模板节点，已有执行数据会保留。确定应用？', '确认同步', {
    type: 'warning',
  });
  try {
    await projectsApi.syncPlan(projectId.value, selectedVersion.value, preview.value.diffHash);
    ElMessage.success('SOP 同步已应用');
    syncDialog.value = false;
    await client.invalidateQueries({ queryKey: ['project-plan', projectId.value] });
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}
function onChecklistChange(id: string, value: unknown): void {
  complete.mutate({ id, value: Boolean(value) });
}
function openTaskEdit(task: PlanTask): void {
  editingTaskId.value = task.id;
  taskForm.value = {
    ownerUserId: task.owner?.id ?? '',
    plannedStartDate: task.plannedStartDate?.slice(0, 10) ?? '',
    plannedEndDate: task.plannedEndDate?.slice(0, 10) ?? '',
  };
  taskDialog.value = true;
}
async function saveTask(): Promise<void> {
  await projectsApi.updatePlanTask(editingTaskId.value, {
    ownerUserId: taskForm.value.ownerUserId || undefined,
    plannedStartDate: taskForm.value.plannedStartDate || undefined,
    plannedEndDate: taskForm.value.plannedEndDate || undefined,
  });
  taskDialog.value = false;
  ElMessage.success('计划任务已更新');
  await client.invalidateQueries({ queryKey: ['project-plan', projectId.value] });
}
</script>
<template>
  <div>
    <div class="filters">
      <div class="filter-row">
        <el-select
          v-model="selectedVersion"
          filterable
          placeholder="选择已发布 SOP 版本"
          style="width: 360px"
          ><template v-for="template in templates.data.value ?? []" :key="template.id"
            ><el-option
              v-for="version in template.versions.filter((item) => item.status === 'PUBLISHED')"
              :key="version.id"
              :label="`${template.name} · ${version.version}`"
              :value="version.id" /></template></el-select
        ><el-button
          v-if="!plan.data.value && auth.has(PERMISSIONS.PLAN_EDIT)"
          type="primary"
          :disabled="!selectedVersion"
          :loading="generate.isPending.value"
          @click="generate.mutate()"
          >生成计划</el-button
        ><el-button
          v-else-if="plan.data.value && auth.has(PERMISSIONS.PLAN_EDIT)"
          :disabled="!selectedVersion || selectedVersion === plan.data.value.sourceSopVersionId"
          @click="showSync"
          >预览 SOP 同步</el-button
        >
      </div>
    </div>
    <el-result
      v-if="plan.isError.value && planMissing"
      icon="info"
      title="尚未生成实施计划"
      sub-title="选择已发布 SOP 版本后生成项目独立快照"
    />
    <el-result
      v-else-if="plan.isError.value"
      icon="error"
      :title="
        plan.error.value instanceof ApiError && plan.error.value.code === 'PERMISSION_DENIED'
          ? '无权查看实施计划'
          : '实施计划加载失败'
      "
      ><template #extra><el-button @click="plan.refetch()">重试</el-button></template></el-result
    >
    <div v-else-if="plan.data.value">
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px">
        <strong>{{ plan.data.value.name }}</strong
        ><span>整体进度 {{ plan.data.value.progress }}%</span>
      </div>
      <article v-for="stage in plan.data.value.stages" :key="stage.id" class="plan-stage">
        <div class="plan-stage-header">
          <div>
            <strong>{{ stage.name }}</strong
            ><span class="muted"> · 权重 {{ stage.weight }}%</span>
          </div>
          <el-progress :percentage="stage.progress" style="width: min(240px, 45%)" />
        </div>
        <div v-for="task in stage.tasks" :key="task.id" class="plan-task">
          <div style="display: flex; justify-content: space-between; gap: 12px">
            <div>
              <strong>{{ task.name }}</strong>
              <div class="muted" style="font-size: 12px; margin-top: 3px">
                {{ task.plannedStartDate?.slice(0, 10) ?? '-' }} 至
                {{ task.plannedEndDate?.slice(0, 10) ?? '-'
                }}<span v-if="task.deliverableRequired">
                  · 必需交付物：{{ task.deliverableName }}</span
                >
              </div>
            </div>
            <StatusTag
              :value="task.progress === 100 ? 'DONE' : task.progress > 0 ? 'IN_PROGRESS' : 'TODO'"
            />
            <el-button
              v-if="auth.has(PERMISSIONS.PLAN_EDIT)"
              link
              type="primary"
              @click="openTaskEdit(task)"
              >编辑</el-button
            >
          </div>
          <el-progress :percentage="task.progress" :stroke-width="7" style="margin-top: 8px" />
          <div v-if="task.checklistItems.length" class="checklist">
            <el-checkbox
              v-for="item in task.checklistItems"
              :key="item.id"
              :model-value="item.completed"
              :disabled="complete.isPending.value || !auth.has(PERMISSIONS.PLAN_EDIT)"
              @change="onChecklistChange(item.id, $event)"
              >{{ item.name }} <span v-if="item.required" class="danger-text">*</span></el-checkbox
            >
          </div>
        </div>
      </article>
    </div>
    <el-dialog v-model="syncDialog" title="SOP 同步差异" width="min(760px,95vw)"
      ><el-table :data="preview?.diff ?? []" max-height="480"
        ><el-table-column prop="operation" label="操作" width="100" /><el-table-column
          prop="entity"
          label="对象"
          width="110" /><el-table-column prop="path" label="路径" min-width="260" /></el-table
      ><el-empty v-if="preview && !preview.diff.length" description="两个版本无差异" /><template
        #footer
        ><el-button @click="syncDialog = false">取消</el-button
        ><el-button type="primary" :disabled="!preview?.diff.length" @click="applySync"
          >确认应用</el-button
        ></template
      ></el-dialog
    >
    <el-dialog v-model="taskDialog" title="编辑计划任务" width="min(520px, 95vw)" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="负责人">
          <el-select v-model="taskForm.ownerUserId" clearable filterable placeholder="选择项目成员">
            <el-option
              v-for="member in members.data.value?.members ?? []"
              :key="member.userId"
              :label="member.user.displayName"
              :value="member.userId"
            />
          </el-select>
        </el-form-item>
        <div class="form-grid">
          <el-form-item label="计划开始"
            ><el-date-picker
              v-model="taskForm.plannedStartDate"
              type="date"
              value-format="YYYY-MM-DD"
          /></el-form-item>
          <el-form-item label="计划结束"
            ><el-date-picker
              v-model="taskForm.plannedEndDate"
              type="date"
              value-format="YYYY-MM-DD"
          /></el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="taskDialog = false">取消</el-button>
        <el-button type="primary" @click="saveTask">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
