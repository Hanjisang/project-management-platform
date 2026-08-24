<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { ElMessage, ElMessageBox } from 'element-plus';
import { tasksApi } from '../../api/tasks.api';
import { useAuthStore } from '../../stores/auth';
import { PERMISSIONS } from '@pmp/shared-constants';
import PageHeader from '../../components/PageHeader.vue';
import StatusTag from '../../components/StatusTag.vue';
import RemoteProjectSelect from '../../components/RemoteProjectSelect.vue';
import ApiErrorView from '../../components/ApiErrorView.vue';
import type { TaskPriority, TaskStatus } from '@pmp/shared-types';
import type { PlanTask, Task, UserRef } from '../../types/domain';
import { projectsApi } from '../../api/projects.api';
import TaskExecutionDrawer from './TaskExecutionDrawer.vue';
const client = useQueryClient();
const auth = useAuthStore();
const route = useRoute();
const detailDrawer = ref(false);
const detailTaskId = ref('');
const dialog = ref(false);
const editDialog = ref(false);
const editingId = ref('');
const memberOptions = ref<UserRef[]>([]);
const planOptions = ref<PlanTask[]>([]);
const page = ref(1);
const pageSize = ref(20);
const filters = reactive<{ projectId: string; status: TaskStatus | ''; search: string }>({
  projectId: '',
  status: '',
  search: '',
});
const form = reactive<{
  projectId: string;
  name: string;
  description: string;
  priority: TaskPriority;
  ownerUserId: string;
  parentWorkItemId: string;
  plannedStartDate: string;
  plannedEndDate: string;
}>({
  projectId: '',
  name: '',
  description: '',
  priority: 'MEDIUM',
  ownerUserId: '',
  parentWorkItemId: '',
  plannedStartDate: '',
  plannedEndDate: '',
});
const editForm = reactive({
  name: '',
  description: '',
  priority: 'MEDIUM' as TaskPriority,
  ownerUserId: '',
  plannedStartDate: '',
  plannedEndDate: '',
  progress: 0,
  status: 'TODO' as Exclude<TaskStatus, 'DONE'>,
});
function sourceLabel(value: string): string {
  return {
    SOP: 'SOP',
    MANUAL: '人工',
    MESSAGE: '消息',
    ISSUE: '问题',
    ZENTAO: '禅道',
    CHANGE: '变更',
  }[value] ?? value;
}
function sourceTagType(value: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' {
  return {
    SOP: 'primary',
    MESSAGE: 'success',
    ISSUE: 'danger',
    ZENTAO: 'info',
    CHANGE: 'warning',
    MANUAL: 'info',
  }[value] as 'primary' | 'success' | 'warning' | 'info' | 'danger';
}
function resetCreateForm(): void {
  Object.assign(form, {
    projectId: '',
    name: '',
    description: '',
    priority: 'MEDIUM',
    ownerUserId: '',
    parentWorkItemId: '',
    plannedStartDate: '',
    plannedEndDate: '',
  });
  memberOptions.value = [];
  planOptions.value = [];
}
const query = useQuery({
  queryKey: computed(() => ['tasks', { ...filters }, page.value, pageSize.value]),
  queryFn: () => tasksApi.list({ ...filters, page: page.value, pageSize: pageSize.value }),
});
watch(filters, () => (page.value = 1), { deep: true });
const create = useMutation({
  mutationFn: () =>
    tasksApi.create({
      ...form,
      ownerUserId: form.ownerUserId || undefined,
      parentWorkItemId: form.parentWorkItemId || undefined,
      plannedStartDate: form.plannedStartDate || undefined,
      plannedEndDate: form.plannedEndDate || undefined,
    }),
  onSuccess: async () => {
    ElMessage.success('任务已创建');
    dialog.value = false;
    resetCreateForm();
    await client.invalidateQueries({ queryKey: ['tasks'] });
  },
  onError: (error: Error) => ElMessage.error(error.message),
});
async function loadProjectOptions(projectId: string): Promise<void> {
  if (!projectId) return;
  const members = await projectsApi.members(projectId);
  memberOptions.value = members.members?.map((item) => item.user) ?? [];
  try {
    const plan = await projectsApi.plan(projectId);
    planOptions.value = plan.stages.flatMap((stage) => stage.workItems);
  } catch {
    planOptions.value = [];
  }
}
watch(
  () => form.projectId,
  (id) => void loadProjectOptions(id),
);
async function openEdit(row: unknown): Promise<void> {
  const task = row as Task;
  editingId.value = task.id;
  await loadProjectOptions(task.projectId);
  Object.assign(editForm, {
    name: task.name,
    description: task.description ?? '',
    priority: task.priority,
    ownerUserId: task.owner?.id ?? '',
    plannedStartDate: task.plannedStartDate?.slice(0, 10) ?? '',
    plannedEndDate: task.plannedEndDate?.slice(0, 10) ?? '',
    progress: task.progress,
    status: task.status === 'DONE' ? 'IN_PROGRESS' : task.status,
  });
  editDialog.value = true;
}
function openDetail(row: unknown): void {
  detailTaskId.value = typeof row === 'string' ? row : (row as Task).id;
  detailDrawer.value = true;
}
watch(
  () => route.query.taskId,
  (value) => {
    if (typeof value === 'string' && value) openDetail(value);
  },
  { immediate: true },
);
async function saveEdit(): Promise<void> {
  const payload = {
    ...editForm,
    ownerUserId: editForm.ownerUserId || undefined,
    plannedStartDate: editForm.plannedStartDate || undefined,
    plannedEndDate: editForm.plannedEndDate || undefined,
  };
  await tasksApi.update(editingId.value, { ...payload });
  editDialog.value = false;
  ElMessage.success('任务已更新');
  await client.invalidateQueries({ queryKey: ['tasks'] });
}
async function cancelTask(id: string): Promise<void> {
  await ElMessageBox.confirm(
    '确定取消该任务？任务将保留在执行历史中，不会物理删除。',
    '取消任务',
    { type: 'warning' },
  );
  await tasksApi.cancel(id, '用户在任务中心取消，保留执行历史');
  ElMessage.success('任务已取消');
  await client.invalidateQueries({ queryKey: ['tasks'] });
  await client.invalidateQueries({ queryKey: ['dashboard'] });
}
async function setStatus(
  id: string,
  status: Exclude<TaskStatus, 'DONE'>,
  progress?: number,
): Promise<void> {
  try {
    await tasksApi.update(id, { status, progress });
    ElMessage.success('任务状态已更新');
    await client.invalidateQueries({ queryKey: ['tasks'] });
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}
async function complete(id: string): Promise<void> {
  try {
    await tasksApi.complete(id);
    ElMessage.success('任务已完成');
    await client.invalidateQueries({ queryKey: ['tasks'] });
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}
</script>
<template>
  <div>
    <PageHeader
      title="任务中心"
      description="统一汇总 SOP、人工、消息、问题、禅道与正式变更新增的 ProjectWorkItem"
    >
      <el-button v-if="auth.has(PERMISSIONS.TASK_CREATE)" type="primary" @click="dialog = true">创建任务</el-button>
    </PageHeader>
    <div class="filters">
      <div class="filter-row">
        <el-input v-model="filters.search" clearable placeholder="搜索任务" style="width: 240px" />
        <RemoteProjectSelect v-model="filters.projectId" placeholder="搜索项目" style="width: 240px" />
        <el-select v-model="filters.status" clearable placeholder="状态" style="width: 150px">
          <el-option
            v-for="status in ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED']"
            :key="status"
            :label="status"
            :value="status"
          />
        </el-select>
      </div>
    </div>
    <ApiErrorView
      v-if="query.isError.value"
      :error="query.error.value"
      title="任务列表加载失败"
      @retry="query.refetch()"
    />
    <div v-else class="panel table-wrap">
      <el-table :data="query.data.value?.items ?? []" v-loading="query.isLoading.value">
        <el-table-column label="任务" min-width="240" fixed>
          <template #default="scope">
            <el-tag size="small" :type="sourceTagType(String(scope.row.sourceType))" style="margin-right: 8px">
              {{ sourceLabel(String(scope.row.sourceType)) }}
            </el-tag>
            <el-link type="primary" @click="openDetail(scope.row)">{{ scope.row.name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="project.name" label="项目" min-width="160" />
        <el-table-column prop="stage.name" label="阶段" min-width="120" />
        <el-table-column prop="parent.name" label="父任务" min-width="160" />
        <el-table-column prop="owner.displayName" label="负责人" width="120" />
        <el-table-column label="Checklist" width="110">
          <template #default="scope">{{
            scope.row.checklistSummary
              ? `${scope.row.checklistSummary.completed}/${scope.row.checklistSummary.total}`
              : '-'
          }}</template>
        </el-table-column>
        <el-table-column label="交付物" width="100">
          <template #default="scope">{{
            scope.row.deliverableSummary
              ? `${scope.row.deliverableSummary.approved}/${scope.row.deliverableSummary.total}`
              : '-'
          }}</template>
        </el-table-column>
        <el-table-column label="优先级" width="100">
          <template #default="scope"><StatusTag :value="scope.row.priority" /></template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="scope"><StatusTag :value="scope.row.status" /></template>
        </el-table-column>
        <el-table-column prop="plannedEndDate" label="截止日期" width="120" />
        <el-table-column label="操作" width="330" fixed="right">
          <template #default="scope">
            <el-button link type="primary" @click="openDetail(scope.row)">详情</el-button>
            <el-button
              v-if="auth.has(PERMISSIONS.TASK_EDIT) && scope.row.status === 'TODO'"
              link
              type="primary"
              @click="setStatus(scope.row.id, 'IN_PROGRESS')"
            >开始</el-button>
            <el-button
              v-if="auth.has(PERMISSIONS.TASK_COMPLETE) && !['DONE', 'CANCELLED'].includes(scope.row.status)"
              link
              type="success"
              @click="complete(scope.row.id)"
            >完成</el-button>
            <el-button
              v-if="auth.has(PERMISSIONS.TASK_EDIT) && scope.row.status === 'BLOCKED'"
              link
              @click="setStatus(scope.row.id, 'IN_PROGRESS')"
            >解除阻塞</el-button>
            <el-button v-if="auth.has(PERMISSIONS.TASK_EDIT)" link @click="openEdit(scope.row)">编辑</el-button>
            <el-button
              v-if="auth.has(PERMISSIONS.TASK_EDIT) && !['DONE', 'CANCELLED'].includes(scope.row.status)"
              link
              type="danger"
              @click="cancelTask(scope.row.id)"
            >取消</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-if="query.data.value?.total"
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="query.data.value.total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        style="padding: 16px"
      />
    </div>
    <el-dialog v-model="dialog" title="创建执行任务" width="min(580px,94vw)" destroy-on-close @closed="resetCreateForm">
      <el-form label-position="top">
        <el-form-item label="项目" required><RemoteProjectSelect v-model="form.projectId" /></el-form-item>
        <el-form-item label="标题" required><el-input v-model.trim="form.name" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
        <div class="content-grid">
          <el-form-item label="优先级">
            <el-select v-model="form.priority" style="width: 100%">
              <el-option v-for="item in ['LOW', 'MEDIUM', 'HIGH', 'URGENT']" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="截止日期"><el-date-picker v-model="form.plannedEndDate" value-format="YYYY-MM-DD" type="date" style="width: 100%" /></el-form-item>
          <el-form-item label="计划开始"><el-date-picker v-model="form.plannedStartDate" value-format="YYYY-MM-DD" type="date" style="width: 100%" /></el-form-item>
          <el-form-item label="负责人">
            <el-select v-model="form.ownerUserId" clearable style="width: 100%">
              <el-option v-for="user in memberOptions" :key="user.id" :label="user.displayName" :value="user.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="父任务（可选）">
            <el-select v-model="form.parentWorkItemId" clearable style="width: 100%">
              <el-option v-for="item in planOptions" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :disabled="!form.projectId || !form.name" :loading="create.isPending.value" @click="create.mutate()">创建</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="editDialog" title="编辑任务" width="min(620px,94vw)" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="标题" required><el-input v-model.trim="editForm.name" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="editForm.description" type="textarea" :rows="3" /></el-form-item>
        <div class="content-grid">
          <el-form-item label="负责人">
            <el-select v-model="editForm.ownerUserId" clearable style="width: 100%">
              <el-option v-for="user in memberOptions" :key="user.id" :label="user.displayName" :value="user.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="优先级">
            <el-select v-model="editForm.priority" style="width: 100%">
              <el-option v-for="item in ['LOW', 'MEDIUM', 'HIGH', 'URGENT']" :key="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="editForm.status" style="width: 100%">
              <el-option v-for="item in ['TODO', 'IN_PROGRESS', 'BLOCKED']" :key="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="进度（含必需项时由系统管理）"><el-input-number v-model="editForm.progress" :min="0" :max="99" /></el-form-item>
          <el-form-item label="计划开始"><el-date-picker v-model="editForm.plannedStartDate" value-format="YYYY-MM-DD" type="date" style="width: 100%" /></el-form-item>
          <el-form-item label="截止日期"><el-date-picker v-model="editForm.plannedEndDate" value-format="YYYY-MM-DD" type="date" style="width: 100%" /></el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="editDialog = false">取消</el-button>
        <el-button type="primary" :disabled="!editForm.name" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
    <TaskExecutionDrawer v-model="detailDrawer" :task-id="detailTaskId" />
  </div>
</template>