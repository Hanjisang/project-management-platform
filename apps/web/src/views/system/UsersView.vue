<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { ElMessage } from 'element-plus';
import { systemApi } from '../../api/system.api';
import PageHeader from '../../components/PageHeader.vue';
import StatusTag from '../../components/StatusTag.vue';
import ApiErrorView from '../../components/ApiErrorView.vue';
import type { UserStatus } from '@pmp/shared-types';
const client = useQueryClient();
const dialog = ref(false);
const editDialog = ref(false);
const editingId = ref('');
const editForm = reactive({
  displayName: '',
  email: '',
  status: 'ACTIVE' as UserStatus,
  roleCodes: [] as string[],
});
const form = reactive({
  username: '',
  password: '',
  displayName: '',
  email: '',
  roleCodes: ['MEMBER'],
});
function resetCreateForm(): void {
  Object.assign(form, {
    username: '',
    password: '',
    displayName: '',
    email: '',
    roleCodes: ['MEMBER'],
  });
}
const users = useQuery({ queryKey: ['users'], queryFn: systemApi.users });
const roles = useQuery({ queryKey: ['roles'], queryFn: systemApi.roles });
function retryUsers(): void {
  void users.refetch();
  void roles.refetch();
}
const create = useMutation({
  mutationFn: () => systemApi.createUser({ ...form, email: form.email || undefined }),
  onSuccess: async () => {
    ElMessage.success('用户已创建');
    dialog.value = false;
    resetCreateForm();
    await client.invalidateQueries({ queryKey: ['users'] });
  },
  onError: (error: Error) => ElMessage.error(error.message),
});
const update = useMutation({
  mutationFn: () =>
    systemApi.updateUser(editingId.value, { ...editForm, email: editForm.email || undefined }),
  onSuccess: async () => {
    ElMessage.success('用户已更新');
    editDialog.value = false;
    await client.invalidateQueries({ queryKey: ['users'] });
  },
  onError: (error: Error) => ElMessage.error(error.message),
});
function openEdit(value: unknown): void {
  const row = value as {
    id: string;
    displayName: string;
    email?: string;
    status: UserStatus;
    roles: Array<{ role: { code: string } }>;
  };
  editingId.value = row.id;
  Object.assign(editForm, {
    displayName: row.displayName,
    email: row.email ?? '',
    status: row.status,
    roleCodes: row.roles.map((item) => item.role.code),
  });
  editDialog.value = true;
}
</script>
<template>
  <div>
    <PageHeader title="用户管理" description="用户可同时拥有多个平台角色"
      ><el-button type="primary" @click="dialog = true">创建用户</el-button></PageHeader
    >
    <ApiErrorView
      v-if="users.isError.value || roles.isError.value"
      :error="users.error.value ?? roles.error.value"
      title="用户管理数据加载失败"
      @retry="retryUsers"
    />
    <div v-else class="panel table-wrap">
      <el-table :data="users.data.value ?? []"
        ><el-table-column prop="username" label="账号" min-width="140" /><el-table-column
          prop="displayName"
          label="姓名"
          min-width="130"
        /><el-table-column prop="email" label="邮箱" min-width="190" /><el-table-column
          label="角色"
          min-width="220"
          ><template #default="scope"
            ><el-tag
              v-for="role in scope.row.roles"
              :key="role.role.code"
              effect="plain"
              style="margin-right: 5px"
              >{{ role.role.name }}</el-tag
            ></template
          ></el-table-column
        ><el-table-column label="状态" width="100"
          ><template #default="scope"
            ><StatusTag :value="scope.row.status" /></template></el-table-column
        ><el-table-column label="操作" width="90"
          ><template #default="scope"
            ><el-button link type="primary" @click="openEdit(scope.row)">编辑</el-button></template
          ></el-table-column
        ></el-table
      >
    </div>
    <el-dialog
      v-model="dialog"
      title="创建用户"
      width="min(580px,94vw)"
      destroy-on-close
      @closed="resetCreateForm"
      ><el-form label-position="top"
        ><div class="content-grid">
          <el-form-item label="账号" required
            ><el-input v-model.trim="form.username" autocomplete="off" /></el-form-item
          ><el-form-item label="姓名" required
            ><el-input v-model.trim="form.displayName"
          /></el-form-item>
        </div>
        <el-form-item label="初始密码（至少 10 位）" required
          ><el-input
            v-model="form.password"
            type="password"
            show-password
            autocomplete="new-password" /></el-form-item
        ><el-form-item label="邮箱"><el-input v-model.trim="form.email" /></el-form-item
        ><el-form-item label="角色" required
          ><el-select v-model="form.roleCodes" multiple style="width: 100%"
            ><el-option
              v-for="role in roles.data.value ?? []"
              :key="role.code"
              :label="role.name"
              :value="role.code" /></el-select></el-form-item></el-form
      ><template #footer
        ><el-button @click="dialog = false">取消</el-button
        ><el-button
          type="primary"
          :disabled="
            !form.username ||
            !form.displayName ||
            form.password.length < 10 ||
            !form.roleCodes.length
          "
          :loading="create.isPending.value"
          @click="create.mutate()"
          >创建</el-button
        ></template
      ></el-dialog
    ><el-dialog v-model="editDialog" title="编辑用户" width="min(560px,94vw)" destroy-on-close
      ><el-form label-position="top"
        ><el-form-item label="姓名" required
          ><el-input v-model.trim="editForm.displayName" /></el-form-item
        ><el-form-item label="邮箱"><el-input v-model.trim="editForm.email" /></el-form-item
        ><el-form-item label="状态"
          ><el-select v-model="editForm.status" style="width: 100%"
            ><el-option
              v-for="item in ['ACTIVE', 'DISABLED', 'LOCKED', 'DEPARTED']"
              :key="item"
              :value="item" /></el-select></el-form-item
        ><el-form-item label="角色" required
          ><el-select v-model="editForm.roleCodes" multiple style="width: 100%"
            ><el-option
              v-for="role in roles.data.value ?? []"
              :key="role.code"
              :label="role.name"
              :value="role.code" /></el-select></el-form-item></el-form
      ><template #footer
        ><el-button @click="editDialog = false">取消</el-button
        ><el-button
          type="primary"
          :disabled="!editForm.displayName || !editForm.roleCodes.length"
          :loading="update.isPending.value"
          @click="update.mutate()"
          >保存</el-button
        ></template
      ></el-dialog
    >
  </div>
</template>
