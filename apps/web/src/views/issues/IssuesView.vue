<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { ElMessage } from 'element-plus';
import { issuesApi } from '../../api/issues.api';
import PageHeader from '../../components/PageHeader.vue';
import StatusTag from '../../components/StatusTag.vue';
import RemoteProjectSelect from '../../components/RemoteProjectSelect.vue';
import ApiErrorView from '../../components/ApiErrorView.vue';
import { PERMISSIONS } from '@pmp/shared-constants';
import { useAuthStore } from '../../stores/auth';
import type { IssueSeverity, IssueStatus, IssueType } from '@pmp/shared-types';
import type { Issue, UserRef } from '../../types/domain';
import { projectsApi } from '../../api/projects.api';
const client = useQueryClient();
const dialog = ref(false);
const editDialog = ref(false);
const editingId = ref('');
const memberOptions = ref<UserRef[]>([]);
const auth = useAuthStore();
const page = ref(1);
const pageSize = ref(20);
const filters = reactive<{
  projectId: string;
  type: IssueType | '';
  severity: IssueSeverity | '';
  status: IssueStatus | '';
}>({ projectId: '', type: '', severity: '', status: '' });
const form = reactive<{
  projectId: string;
  type: IssueType;
  title: string;
  description: string;
  severity: IssueSeverity;
  ownerUserId: string;
  dueDate: string;
  probability: number;
  impact: number;
}>({
  projectId: '',
  type: 'ISSUE',
  title: '',
  description: '',
  severity: 'MEDIUM',
  ownerUserId: '',
  dueDate: '',
  probability: 3,
  impact: 3,
});
const editForm = reactive({
  type: 'ISSUE' as IssueType,
  title: '',
  description: '',
  severity: 'MEDIUM' as IssueSeverity,
  ownerUserId: '',
  dueDate: '',
  probability: 3,
  impact: 3,
  status: 'OPEN' as Exclude<IssueStatus, 'RESOLVED' | 'CLOSED'>,
});
function resetCreateForm(): void {
  Object.assign(form, {
    projectId: '',
    type: 'ISSUE',
    title: '',
    description: '',
    severity: 'MEDIUM',
    ownerUserId: '',
    dueDate: '',
    probability: 3,
    impact: 3,
  });
  memberOptions.value = [];
}
const query = useQuery({
  queryKey: computed(() => ['issues', { ...filters }, page.value, pageSize.value]),
  queryFn: () => issuesApi.list({ ...filters, page: page.value, pageSize: pageSize.value }),
});
watch(filters, () => (page.value = 1), { deep: true });
const create = useMutation({
  mutationFn: () =>
    issuesApi.create({
      ...form,
      ownerUserId: form.ownerUserId || undefined,
      dueDate: form.dueDate || undefined,
      probability: ['RISK', 'BLOCKER'].includes(form.type) ? form.probability : undefined,
      impact: ['RISK', 'BLOCKER'].includes(form.type) ? form.impact : undefined,
    }),
  onSuccess: async () => {
    ElMessage.success('问题或风险已创建');
    dialog.value = false;
    resetCreateForm();
    await client.invalidateQueries({ queryKey: ['issues'] });
  },
  onError: (error: Error) => ElMessage.error(error.message),
});
async function loadMembers(projectId: string): Promise<void> {
  if (!projectId) return;
  const members = await projectsApi.members(projectId);
  memberOptions.value = members.members?.map((item) => item.user) ?? [];
}
watch(
  () => form.projectId,
  (id) => void loadMembers(id),
);
async function openEdit(row: unknown): Promise<void> {
  const issue = await issuesApi.get((row as Issue).id);
  editingId.value = issue.id;
  await loadMembers(issue.projectId);
  Object.assign(editForm, {
    type: issue.type,
    title: issue.title,
    description: issue.description ?? '',
    severity: issue.severity,
    ownerUserId: issue.owner?.id ?? '',
    dueDate: issue.dueDate?.slice(0, 10) ?? '',
    probability: issue.probability ?? 3,
    impact: issue.impact ?? 3,
    status: ['RESOLVED', 'CLOSED'].includes(issue.status) ? 'WAITING' : issue.status,
  });
  editDialog.value = true;
}
async function saveEdit(): Promise<void> {
  await issuesApi.update(editingId.value, {
    ...editForm,
    ownerUserId: editForm.ownerUserId || undefined,
    dueDate: editForm.dueDate || undefined,
    probability: ['RISK', 'BLOCKER'].includes(editForm.type) ? editForm.probability : undefined,
    impact: ['RISK', 'BLOCKER'].includes(editForm.type) ? editForm.impact : undefined,
  });
  editDialog.value = false;
  ElMessage.success('问题已更新');
  await client.invalidateQueries({ queryKey: ['issues'] });
}
async function close(id: string): Promise<void> {
  try {
    await issuesApi.close(id);
    ElMessage.success('问题已关闭');
    await client.invalidateQueries({ queryKey: ['issues'] });
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}
async function resolve(id: string): Promise<void> {
  try {
    await issuesApi.resolve(id);
    ElMessage.success('问题已解决');
    await client.invalidateQueries({ queryKey: ['issues'] });
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}
</script>
<template>
  <div>
    <PageHeader
      title="问题与风险"
      description="统一管理问题、风险、变更和阻塞项，风险分数会影响项目健康度"
      ><el-button v-if="auth.has(PERMISSIONS.ISSUE_CREATE)" type="primary" @click="dialog = true"
        >新增问题风险</el-button
      ></PageHeader
    >
    <div class="filters">
      <div class="filter-row">
        <RemoteProjectSelect
          v-model="filters.projectId"
          placeholder="搜索项目"
          style="width: 230px"
        />
        ><el-select v-model="filters.type" clearable placeholder="类型" style="width: 140px"
          ><el-option
            v-for="item in ['ISSUE', 'RISK', 'CHANGE', 'BLOCKER']"
            :key="item"
            :label="item"
            :value="item" /></el-select
        ><el-select v-model="filters.severity" clearable placeholder="等级" style="width: 140px"
          ><el-option
            v-for="item in ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']"
            :key="item"
            :label="item"
            :value="item" /></el-select
        ><el-select v-model="filters.status" clearable placeholder="状态" style="width: 140px"
          ><el-option
            v-for="item in ['OPEN', 'PROCESSING', 'WAITING', 'RESOLVED', 'CLOSED']"
            :key="item"
            :label="item"
            :value="item"
        /></el-select>
      </div>
    </div>
    <ApiErrorView
      v-if="query.isError.value"
      :error="query.error.value"
      title="问题风险加载失败"
      @retry="query.refetch()"
    />
    <div v-else class="panel table-wrap">
      <el-table :data="query.data.value?.items ?? []"
        ><el-table-column prop="title" label="标题" min-width="230" fixed /><el-table-column
          prop="project.name"
          label="项目"
          min-width="160"
        /><el-table-column prop="type" label="类型" width="100" /><el-table-column
          label="等级"
          width="100"
          ><template #default="scope"
            ><StatusTag :value="scope.row.severity" /></template></el-table-column
        ><el-table-column label="状态" width="110"
          ><template #default="scope"
            ><StatusTag :value="scope.row.status" /></template></el-table-column
        ><el-table-column prop="riskScore" label="风险分" width="90" /><el-table-column
          prop="dueDate"
          label="截止日期"
          width="120"
        /><el-table-column label="操作" width="210" fixed="right"
          ><template #default="scope"
            ><el-button
              v-if="
                auth.has(PERMISSIONS.ISSUE_EDIT) &&
                !['RESOLVED', 'CLOSED'].includes(scope.row.status)
              "
              link
              type="success"
              @click="resolve(scope.row.id)"
              >解决</el-button
            ><el-button
              v-if="auth.has(PERMISSIONS.ISSUE_CLOSE) && scope.row.status === 'RESOLVED'"
              link
              type="danger"
              @click="close(scope.row.id)"
              >关闭</el-button
            ><el-button v-if="auth.has(PERMISSIONS.ISSUE_EDIT)" link @click="openEdit(scope.row)"
              >编辑</el-button
            ></template
          ></el-table-column
        ></el-table
      >
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
    <el-dialog
      v-model="dialog"
      title="新增问题或风险"
      width="min(620px,94vw)"
      destroy-on-close
      @closed="resetCreateForm"
      ><el-form label-position="top"
        ><div class="content-grid">
          <el-form-item label="项目" required
            ><RemoteProjectSelect v-model="form.projectId" /></el-form-item
          ><el-form-item label="类型" required
            ><el-select v-model="form.type" style="width: 100%"
              ><el-option
                v-for="item in ['ISSUE', 'RISK', 'CHANGE', 'BLOCKER']"
                :key="item"
                :label="item"
                :value="item" /></el-select
          ></el-form-item>
        </div>
        <el-form-item label="标题" required><el-input v-model.trim="form.title" /></el-form-item
        ><el-form-item label="说明"
          ><el-input v-model="form.description" type="textarea" :rows="3"
        /></el-form-item>
        <div class="content-grid">
          <el-form-item label="等级"
            ><el-select v-model="form.severity" style="width: 100%"
              ><el-option
                v-for="item in ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']"
                :key="item"
                :label="item"
                :value="item" /></el-select></el-form-item
          ><el-form-item label="截止日期"
            ><el-date-picker
              v-model="form.dueDate"
              value-format="YYYY-MM-DD"
              type="date"
              style="width: 100%" /></el-form-item
          ><el-form-item label="负责人"
            ><el-select v-model="form.ownerUserId" clearable style="width: 100%"
              ><el-option
                v-for="user in memberOptions"
                :key="user.id"
                :label="user.displayName"
                :value="user.id" /></el-select></el-form-item
          ><el-form-item v-if="['RISK', 'BLOCKER'].includes(form.type)" label="发生概率 (1-5)"
            ><el-input-number v-model="form.probability" :min="1" :max="5" /></el-form-item
          ><el-form-item v-if="['RISK', 'BLOCKER'].includes(form.type)" label="影响程度 (1-5)"
            ><el-input-number v-model="form.impact" :min="1" :max="5"
          /></el-form-item></div></el-form
      ><template #footer
        ><el-button @click="dialog = false">取消</el-button
        ><el-button
          type="primary"
          :disabled="!form.projectId || !form.title"
          :loading="create.isPending.value"
          @click="create.mutate()"
          >创建</el-button
        ></template
      ></el-dialog
    ><el-dialog v-model="editDialog" title="编辑问题风险" width="min(640px,94vw)" destroy-on-close
      ><el-form label-position="top"
        ><el-form-item label="标题" required
          ><el-input v-model.trim="editForm.title" /></el-form-item
        ><el-form-item label="说明"
          ><el-input v-model="editForm.description" type="textarea" :rows="3"
        /></el-form-item>
        <div class="content-grid">
          <el-form-item label="类型"
            ><el-select v-model="editForm.type" style="width: 100%"
              ><el-option
                v-for="item in ['ISSUE', 'RISK', 'CHANGE', 'BLOCKER']"
                :key="item"
                :value="item" /></el-select></el-form-item
          ><el-form-item label="等级"
            ><el-select v-model="editForm.severity" style="width: 100%"
              ><el-option
                v-for="item in ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']"
                :key="item"
                :value="item" /></el-select></el-form-item
          ><el-form-item label="状态"
            ><el-select v-model="editForm.status" style="width: 100%"
              ><el-option
                v-for="item in ['OPEN', 'PROCESSING', 'WAITING']"
                :key="item"
                :value="item" /></el-select></el-form-item
          ><el-form-item label="负责人"
            ><el-select v-model="editForm.ownerUserId" clearable style="width: 100%"
              ><el-option
                v-for="user in memberOptions"
                :key="user.id"
                :label="user.displayName"
                :value="user.id" /></el-select></el-form-item
          ><el-form-item label="截止日期"
            ><el-date-picker
              v-model="editForm.dueDate"
              value-format="YYYY-MM-DD"
              type="date"
              style="width: 100%" /></el-form-item
          ><template v-if="['RISK', 'BLOCKER'].includes(editForm.type)"
            ><el-form-item label="发生概率"
              ><el-input-number v-model="editForm.probability" :min="1" :max="5" /></el-form-item
            ><el-form-item label="影响程度"
              ><el-input-number v-model="editForm.impact" :min="1" :max="5" /></el-form-item
          ></template></div></el-form
      ><template #footer
        ><el-button @click="editDialog = false">取消</el-button
        ><el-button type="primary" :disabled="!editForm.title" @click="saveEdit"
          >保存</el-button
        ></template
      ></el-dialog
    >
  </div>
</template>
