<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { ElMessage } from 'element-plus';
import { systemApi } from '../../api/system.api';
import PageHeader from '../../components/PageHeader.vue';
import StatusTag from '../../components/StatusTag.vue';
const client = useQueryClient();
const dialog = ref(false);
const form = reactive({
  username: '',
  password: '',
  displayName: '',
  email: '',
  roleCodes: ['MEMBER'],
});
const users = useQuery({ queryKey: ['users'], queryFn: systemApi.users });
const roles = useQuery({ queryKey: ['roles'], queryFn: systemApi.roles });
const create = useMutation({
  mutationFn: () => systemApi.createUser({ ...form, email: form.email || undefined }),
  onSuccess: async () => {
    ElMessage.success('用户已创建');
    dialog.value = false;
    await client.invalidateQueries({ queryKey: ['users'] });
  },
  onError: (error: Error) => ElMessage.error(error.message),
});
</script>
<template>
  <div>
    <PageHeader title="用户管理" description="用户可同时拥有多个平台角色"
      ><el-button type="primary" @click="dialog = true">创建用户</el-button></PageHeader
    >
    <div class="panel table-wrap">
      <el-table :data="users.data.value ?? []"
        ><el-table-column prop="username" label="账号" min-width="140" /><el-table-column
          prop="displayName"
          label="姓名"
          min-width="130" /><el-table-column
          prop="email"
          label="邮箱"
          min-width="190" /><el-table-column label="角色" min-width="220"
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
      ></el-table>
    </div>
    <el-dialog v-model="dialog" title="创建用户" width="min(580px,94vw)"
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
    >
  </div>
</template>
