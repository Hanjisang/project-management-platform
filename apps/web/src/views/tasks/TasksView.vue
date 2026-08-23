<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { ElMessage } from 'element-plus';
import { tasksApi } from '../../api/tasks.api';
import { projectsApi } from '../../api/projects.api';
import { useAuthStore } from '../../stores/auth';
import PageHeader from '../../components/PageHeader.vue';
import StatusTag from '../../components/StatusTag.vue';
const client = useQueryClient();
const auth = useAuthStore();
const dialog = ref(false);
const filters = reactive({ projectId: '', status: '', search: '' });
const form = reactive({
  projectId: '',
  title: '',
  description: '',
  priority: 'MEDIUM',
  dueDate: '',
});
const projects = useQuery({
  queryKey: ['projects', 'task-selector'],
  queryFn: () => projectsApi.list({ pageSize: 100 }),
});
const query = useQuery({
  queryKey: ['tasks', filters],
  queryFn: () => tasksApi.list({ ...filters, pageSize: 100 }),
});
const create = useMutation({
  mutationFn: () => tasksApi.create({ ...form, dueDate: form.dueDate || undefined }),
  onSuccess: async () => {
    ElMessage.success('任务已创建');
    dialog.value = false;
    await client.invalidateQueries({ queryKey: ['tasks'] });
  },
  onError: (error: Error) => ElMessage.error(error.message),
});
async function setStatus(id: string, status: string, progress?: number): Promise<void> {
  try {
    await tasksApi.update(id, { status, progress });
    ElMessage.success('任务状态已更新');
    await client.invalidateQueries({ queryKey: ['tasks'] });
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}
</script>
<template>
  <div>
    <PageHeader title="任务中心" description="执行 Task 可关联计划节点，也可作为临时任务独立存在"
      ><el-button v-if="auth.has('task.create')" type="primary" @click="dialog = true"
        >创建任务</el-button
      ></PageHeader
    >
    <div class="filters">
      <div class="filter-row">
        <el-input
          v-model="filters.search"
          clearable
          placeholder="搜索任务"
          style="width: 240px"
        /><el-select
          v-model="filters.projectId"
          clearable
          filterable
          placeholder="项目"
          style="width: 240px"
          ><el-option
            v-for="project in projects.data.value?.items ?? []"
            :key="project.id"
            :label="project.name"
            :value="project.id" /></el-select
        ><el-select v-model="filters.status" clearable placeholder="状态" style="width: 150px"
          ><el-option
            v-for="status in ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED']"
            :key="status"
            :label="status"
            :value="status"
        /></el-select>
      </div>
    </div>
    <div class="panel table-wrap">
      <el-table :data="query.data.value?.items ?? []" v-loading="query.isLoading.value"
        ><el-table-column prop="title" label="任务" min-width="220" fixed /><el-table-column
          prop="project.name"
          label="项目"
          min-width="160"
        /><el-table-column prop="planTask.name" label="计划节点" min-width="160" /><el-table-column
          prop="owner.displayName"
          label="负责人"
          width="120"
        /><el-table-column label="优先级" width="100"
          ><template #default="scope"
            ><StatusTag :value="scope.row.priority" /></template></el-table-column
        ><el-table-column label="状态" width="110"
          ><template #default="scope"
            ><StatusTag :value="scope.row.status" /></template></el-table-column
        ><el-table-column prop="dueDate" label="截止日期" width="120" /><el-table-column
          label="操作"
          width="190"
          fixed="right"
          ><template #default="scope"
            ><el-button
              v-if="auth.has('task.edit') && scope.row.status === 'TODO'"
              link
              type="primary"
              @click="setStatus(scope.row.id, 'IN_PROGRESS')"
              >开始</el-button
            ><el-button
              v-if="auth.has('task.edit') && !['DONE', 'CANCELLED'].includes(scope.row.status)"
              link
              type="success"
              @click="setStatus(scope.row.id, 'DONE', 100)"
              >完成</el-button
            ><el-button
              v-if="auth.has('task.edit') && scope.row.status === 'BLOCKED'"
              link
              @click="setStatus(scope.row.id, 'IN_PROGRESS')"
              >解除阻塞</el-button
            ></template
          ></el-table-column
        ></el-table
      >
    </div>
    <el-dialog v-model="dialog" title="创建执行任务" width="min(580px,94vw)"
      ><el-form label-position="top"
        ><el-form-item label="项目" required
          ><el-select v-model="form.projectId" filterable style="width: 100%"
            ><el-option
              v-for="project in projects.data.value?.items ?? []"
              :key="project.id"
              :label="`${project.code} · ${project.name}`"
              :value="project.id" /></el-select></el-form-item
        ><el-form-item label="标题" required><el-input v-model.trim="form.title" /></el-form-item
        ><el-form-item label="说明"
          ><el-input v-model="form.description" type="textarea" :rows="3"
        /></el-form-item>
        <div class="content-grid">
          <el-form-item label="优先级"
            ><el-select v-model="form.priority" style="width: 100%"
              ><el-option
                v-for="item in ['LOW', 'MEDIUM', 'HIGH', 'URGENT']"
                :key="item"
                :label="item"
                :value="item" /></el-select></el-form-item
          ><el-form-item label="截止日期"
            ><el-date-picker
              v-model="form.dueDate"
              value-format="YYYY-MM-DD"
              type="date"
              style="width: 100%"
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
    >
  </div>
</template>
