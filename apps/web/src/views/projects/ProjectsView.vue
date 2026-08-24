<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { PERMISSIONS } from '@pmp/shared-constants';
import { projectsApi } from '../../api/projects.api';
import { useAuthStore } from '../../stores/auth';
import type { Project } from '../../types/domain';
import PageHeader from '../../components/PageHeader.vue';
import StatusTag from '../../components/StatusTag.vue';
import RemoteUserSelect from '../../components/RemoteUserSelect.vue';
import ApiErrorView from '../../components/ApiErrorView.vue';
import type { ProjectHealth, ProjectStatus } from '@pmp/shared-types';
const stored = sessionStorage.getItem('pmp:project-filters');
const filters = reactive<{
  search: string;
  status: ProjectStatus | '';
  health: ProjectHealth | '';
}>(
  stored
    ? (JSON.parse(stored) as {
        search: string;
        status: ProjectStatus | '';
        health: ProjectHealth | '';
      })
    : { search: '', status: '', health: '' },
);
watch(filters, (value) => sessionStorage.setItem('pmp:project-filters', JSON.stringify(value)), {
  deep: true,
});
const page = ref(1);
const pageSize = ref(20);
watch(filters, () => (page.value = 1), { deep: true });
const router = useRouter();
const auth = useAuthStore();
const client = useQueryClient();
const dialog = ref(false);
const form = reactive({
  code: '',
  name: '',
  customerName: '',
  managerUserId: '',
  plannedStartDate: '',
  plannedGoLiveDate: '',
  description: '',
});
function resetCreateForm(): void {
  Object.assign(form, {
    code: '',
    name: '',
    customerName: '',
    managerUserId: '',
    plannedStartDate: '',
    plannedGoLiveDate: '',
    description: '',
  });
}
const query = useQuery({
  queryKey: computed(() => ['projects', { ...filters }, page.value, pageSize.value]),
  queryFn: () => projectsApi.list({ ...filters, page: page.value, pageSize: pageSize.value }),
});
const create = useMutation({
  mutationFn: () =>
    projectsApi.create({
      ...form,
      plannedStartDate: form.plannedStartDate || undefined,
      plannedGoLiveDate: form.plannedGoLiveDate || undefined,
    }),
  onSuccess: async (project) => {
    ElMessage.success('项目已创建');
    dialog.value = false;
    resetCreateForm();
    await client.invalidateQueries({ queryKey: ['projects'] });
    await router.push(`/projects/${project.id}`);
  },
  onError: (error: Error) => ElMessage.error(error.message),
});
function openProject(row: Project): void {
  void router.push(`/projects/${row.id}`);
}
</script>
<template>
  <div>
    <PageHeader title="项目管理" description="统一跟踪项目状态、健康度、上线日期与交付进度"
      ><el-button v-if="auth.has(PERMISSIONS.PROJECT_CREATE)" type="primary" @click="dialog = true"
        >创建项目</el-button
      ></PageHeader
    >
    <div class="filters">
      <div class="filter-row">
        <el-input
          v-model="filters.search"
          clearable
          placeholder="搜索编码、项目或客户"
          style="width: 260px"
        /><el-select v-model="filters.status" clearable placeholder="项目状态" style="width: 150px"
          ><el-option
            v-for="item in ['NOT_STARTED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']"
            :key="item"
            :label="item"
            :value="item" /></el-select
        ><el-select v-model="filters.health" clearable placeholder="健康度" style="width: 140px"
          ><el-option label="正常" value="NORMAL" /><el-option
            label="预警"
            value="WARNING" /><el-option label="高风险" value="HIGH_RISK"
        /></el-select>
      </div>
    </div>
    <ApiErrorView
      v-if="query.isError.value"
      :error="query.error.value"
      title="项目列表加载失败"
      @retry="query.refetch()"
    />
    <div v-else class="panel table-wrap">
      <el-table
        v-loading="query.isLoading.value"
        :data="query.data.value?.items ?? []"
        row-key="id"
        @row-click="openProject"
        ><el-table-column prop="code" label="项目编码" width="130" fixed /><el-table-column
          prop="name"
          label="项目名称"
          min-width="210"
          show-overflow-tooltip /><el-table-column
          prop="customerName"
          label="客户"
          min-width="170"
          show-overflow-tooltip /><el-table-column
          prop="manager.displayName"
          label="负责人"
          width="120" /><el-table-column label="状态" width="100"
          ><template #default="scope"
            ><StatusTag :value="scope.row.status" /></template></el-table-column
        ><el-table-column label="健康度" width="100"
          ><template #default="scope"
            ><StatusTag :value="scope.row.health" /></template></el-table-column
        ><el-table-column label="进度" min-width="180"
          ><template #default="scope"
            ><div class="progress-cell">
              <el-progress :percentage="scope.row.progress" /><span>{{ scope.row.progress }}%</span>
            </div></template
          ></el-table-column
        ><el-table-column prop="plannedGoLiveDate" label="计划上线" width="120" /></el-table
      ><el-empty
        v-if="!query.isLoading.value && !query.data.value?.items.length"
        description="没有匹配的项目"
      />
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
      title="创建项目"
      width="min(640px, 94vw)"
      destroy-on-close
      @closed="resetCreateForm"
      ><el-form label-position="top"
        ><div class="content-grid">
          <el-form-item label="项目编码" required
            ><el-input v-model.trim="form.code" placeholder="P2026-001" /></el-form-item
          ><el-form-item label="项目名称" required
            ><el-input v-model.trim="form.name" /></el-form-item
          ><el-form-item label="客户名称" required
            ><el-input v-model.trim="form.customerName" /></el-form-item
          ><el-form-item label="项目负责人" required
            ><RemoteUserSelect v-model="form.managerUserId" /></el-form-item
          ><el-form-item label="计划开始"
            ><el-date-picker
              v-model="form.plannedStartDate"
              type="date"
              value-format="YYYY-MM-DD"
              style="width: 100%" /></el-form-item
          ><el-form-item label="计划上线"
            ><el-date-picker
              v-model="form.plannedGoLiveDate"
              type="date"
              value-format="YYYY-MM-DD"
              style="width: 100%"
          /></el-form-item>
        </div>
        <el-form-item label="项目说明"
          ><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item></el-form
      ><template #footer
        ><el-button @click="dialog = false">取消</el-button
        ><el-button
          type="primary"
          :loading="create.isPending.value"
          :disabled="!form.code || !form.name || !form.customerName || !form.managerUserId"
          @click="create.mutate()"
          >创建</el-button
        ></template
      ></el-dialog
    >
  </div>
</template>
