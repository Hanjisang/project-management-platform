<script setup lang="ts">
import { ref, toRef, watch } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { ElMessage } from 'element-plus';
import { projectsApi } from '../../api/projects.api';
import { PERMISSIONS } from '@pmp/shared-constants';
import { useAuthStore } from '../../stores/auth';
import RemoteUserSelect from '../../components/RemoteUserSelect.vue';
import ApiErrorView from '../../components/ApiErrorView.vue';
import { projectQueryKey } from '../../composables/project-query';
import { cloneMemberRows } from './member-edit-state';
import type { ProjectRole } from '@pmp/shared-types';
const props = defineProps<{ projectId: string }>();
const projectId = toRef(props, 'projectId');
const auth = useAuthStore();
const client = useQueryClient();
const editing = ref(false);
const rows = ref<Array<{ userId: string; projectRole: ProjectRole }>>([]);
const snapshot = ref<Array<{ userId: string; projectRole: ProjectRole }>>([]);
const members = useQuery({
  queryKey: projectQueryKey('project-members', projectId),
  queryFn: () => projectsApi.members(projectId.value),
});
const users = useQuery({
  queryKey: ['project-user-options'],
  queryFn: () => projectsApi.userOptions({ page: 1, pageSize: 20 }),
});
watch(
  () => members.data.value,
  (value) => {
    if (value?.members)
      snapshot.value = value.members.map((item) => ({
        userId: item.userId,
        projectRole: item.projectRole,
      }));
    if (!editing.value) rows.value = cloneMemberRows(snapshot.value);
  },
  { immediate: true },
);
const save = useMutation({
  mutationFn: () => projectsApi.setMembers(projectId.value, rows.value),
  onSuccess: async () => {
    ElMessage.success('项目成员已更新');
    editing.value = false;
    snapshot.value = cloneMemberRows(rows.value);
    await client.invalidateQueries({ queryKey: ['project-members', projectId.value] });
  },
  onError: (error: Error) => ElMessage.error(error.message),
});
function add(): void {
  const candidate = users.data.value?.items.find(
    (user) => !rows.value.some((row) => row.userId === user.id),
  );
  if (candidate) rows.value.push({ userId: candidate.id, projectRole: 'IMPLEMENTER' });
}
function retryMembers(): void {
  void members.refetch();
  void users.refetch();
}
function toggleEditing(): void {
  if (editing.value) {
    rows.value = cloneMemberRows(snapshot.value);
    editing.value = false;
    return;
  }
  snapshot.value = cloneMemberRows(rows.value);
  editing.value = true;
}
</script>
<template>
  <div>
    <div class="page-toolbar">
      <div>
        <h2 style="font-size: 16px">项目成员</h2>
        <p>项目角色与平台 RBAC 角色相互独立</p>
      </div>
      <el-button
        v-if="auth.has(PERMISSIONS.PROJECT_MEMBER_MANAGE)"
        type="primary"
        @click="toggleEditing"
        >{{ editing ? '取消' : '管理成员' }}</el-button
      >
    </div>
    <ApiErrorView
      v-if="members.isError.value || (editing && users.isError.value)"
      :error="members.error.value ?? users.error.value"
      title="项目成员加载失败"
      @retry="retryMembers"
    />
    <div v-else-if="!editing" class="table-wrap">
      <el-table :data="members.data.value?.members ?? []"
        ><el-table-column prop="user.displayName" label="成员" min-width="150" /><el-table-column
          prop="user.username"
          label="账号"
          min-width="130" /><el-table-column prop="projectRole" label="项目角色" min-width="150"
      /></el-table>
    </div>
    <div v-else>
      <div
        v-for="(row, index) in rows"
        :key="row.userId"
        class="filter-row"
        style="margin-bottom: 10px"
      >
        <RemoteUserSelect v-model="row.userId" style="width: 240px" />
        ><el-select v-model="row.projectRole" style="width: 180px"
          ><el-option
            v-for="role in [
              'PROJECT_MANAGER',
              'IMPLEMENTER',
              'DEVELOPER',
              'PRODUCT',
              'TESTER',
              'VIEWER',
            ]"
            :key="role"
            :label="role"
            :value="role" /></el-select
        ><el-button
          type="danger"
          plain
          :disabled="row.userId === members.data.value?.managerUserId"
          @click="rows.splice(index, 1)"
          >移除</el-button
        >
      </div>
      <div class="toolbar-actions">
        <el-button @click="add">添加成员</el-button
        ><el-button type="primary" :loading="save.isPending.value" @click="save.mutate()"
          >保存成员</el-button
        >
      </div>
    </div>
  </div>
</template>
