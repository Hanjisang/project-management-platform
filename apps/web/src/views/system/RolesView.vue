<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { ElMessage } from 'element-plus';
import PageHeader from '../../components/PageHeader.vue';
import { systemApi } from '../../api/system.api';

const queryClient = useQueryClient();
const dialogVisible = ref(false);
const form = reactive({ code: '', name: '', description: '', permissionCodes: [] as string[] });
const roles = useQuery({ queryKey: ['roles'], queryFn: systemApi.roles });
const permissions = useQuery({ queryKey: ['permissions'], queryFn: systemApi.permissions });
const permissionGroups = computed(() => {
  const groups = new Map<string, NonNullable<typeof permissions.data.value>>();
  for (const permission of permissions.data.value ?? []) {
    const group = permission.code.split('.')[0] ?? 'other';
    groups.set(group, [...(groups.get(group) ?? []), permission]);
  }
  return [...groups.entries()];
});
const createRole = useMutation({
  mutationFn: () =>
    systemApi.createRole({
      ...form,
      code: form.code.trim().toUpperCase(),
      description: form.description || undefined,
    }),
  onSuccess: async () => {
    ElMessage.success('角色已创建');
    dialogVisible.value = false;
    Object.assign(form, { code: '', name: '', description: '', permissionCodes: [] });
    await queryClient.invalidateQueries({ queryKey: ['roles'] });
  },
  onError: (error: Error) => ElMessage.error(error.message),
});
</script>

<template>
  <div>
    <PageHeader title="角色与权限" description="平台权限集中配置，项目范围仍由项目成员关系控制">
      <el-button type="primary" @click="dialogVisible = true">创建角色</el-button>
    </PageHeader>
    <div class="panel table-wrap">
      <el-table v-loading="roles.isLoading.value" :data="roles.data.value ?? []">
        <el-table-column prop="name" label="角色" min-width="150">
          <template #default="scope">
            <strong>{{ scope.row.name }}</strong>
            <el-tag v-if="scope.row.system" size="small" effect="plain" style="margin-left: 8px"
              >系统</el-tag
            >
          </template>
        </el-table-column>
        <el-table-column prop="code" label="编码" min-width="150" />
        <el-table-column prop="description" label="说明" min-width="220" show-overflow-tooltip />
        <el-table-column label="权限" min-width="330">
          <template #default="scope">
            <el-tooltip
              :content="
                scope.row.permissions
                  .map((item: { permission: { name: string } }) => item.permission.name)
                  .join('、')
              "
              placement="top"
            >
              <span>{{ scope.row.permissions.length }} 项权限</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="用户数" width="100" align="right">
          <template #default="scope">{{ scope.row._count?.users ?? 0 }}</template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" title="创建角色" width="min(720px, 94vw)">
      <el-form label-position="top">
        <div class="content-grid">
          <el-form-item label="角色编码" required
            ><el-input v-model.trim="form.code" placeholder="例如 DELIVERY_LEAD"
          /></el-form-item>
          <el-form-item label="角色名称" required
            ><el-input v-model.trim="form.name" placeholder="例如 交付负责人"
          /></el-form-item>
        </div>
        <el-form-item label="说明"
          ><el-input v-model.trim="form.description" type="textarea" :rows="2"
        /></el-form-item>
        <el-form-item label="权限" required>
          <div class="permission-groups">
            <section v-for="[group, items] in permissionGroups" :key="group">
              <strong>{{ group.toUpperCase() }}</strong>
              <el-checkbox-group v-model="form.permissionCodes">
                <el-checkbox
                  v-for="permission in items"
                  :key="permission.code"
                  :value="permission.code"
                  >{{ permission.name }}</el-checkbox
                >
              </el-checkbox-group>
            </section>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="!form.code || !form.name || !form.permissionCodes.length"
          :loading="createRole.isPending.value"
          @click="createRole.mutate()"
          >创建</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.permission-groups {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.permission-groups section {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-subtle);
}
.permission-groups strong {
  display: block;
  margin-bottom: 8px;
  color: var(--text-muted);
  font-size: 12px;
}
.permission-groups .el-checkbox-group {
  display: grid;
  gap: 6px;
}
@media (max-width: 640px) {
  .permission-groups {
    grid-template-columns: 1fr;
  }
}
</style>
