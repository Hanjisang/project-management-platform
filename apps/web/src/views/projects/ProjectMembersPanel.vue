<script setup lang="ts">
import { ref, watch } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { ElMessage } from 'element-plus';
import { projectsApi } from '../../api/projects.api';
const props = defineProps<{ projectId: string }>();
const client = useQueryClient();
const editing = ref(false);
const rows = ref<Array<{ userId: string; projectRole: string }>>([]);
const members = useQuery({
  queryKey: ['project-members', props.projectId],
  queryFn: () => projectsApi.members(props.projectId),
});
const users = useQuery({ queryKey: ['project-user-options'], queryFn: projectsApi.userOptions });
watch(
  () => members.data.value,
  (value) => {
    if (value?.members)
      rows.value = value.members.map((item) => ({
        userId: item.userId,
        projectRole: item.projectRole,
      }));
  },
  { immediate: true },
);
const save = useMutation({
  mutationFn: () => projectsApi.setMembers(props.projectId, rows.value),
  onSuccess: async () => {
    ElMessage.success('项目成员已更新');
    editing.value = false;
    await client.invalidateQueries({ queryKey: ['project-members', props.projectId] });
  },
  onError: (error: Error) => ElMessage.error(error.message),
});
function add(): void {
  const candidate = users.data.value?.find(
    (user) => !rows.value.some((row) => row.userId === user.id),
  );
  if (candidate) rows.value.push({ userId: candidate.id, projectRole: 'IMPLEMENTER' });
}
</script>
<template>
  <div>
    <div class="page-toolbar">
      <div>
        <h2 style="font-size: 16px">项目成员</h2>
        <p>项目角色与平台 RBAC 角色相互独立</p>
      </div>
      <el-button type="primary" @click="editing = !editing">{{
        editing ? '取消' : '管理成员'
      }}</el-button>
    </div>
    <div v-if="!editing" class="table-wrap">
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
        <el-select v-model="row.userId" filterable style="width: 240px"
          ><el-option
            v-for="user in users.data.value ?? []"
            :key="user.id"
            :label="`${user.displayName} (${user.username})`"
            :value="user.id"
            :disabled="
              rows.some((entry, i) => i !== index && entry.userId === user.id)
            " /></el-select
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
