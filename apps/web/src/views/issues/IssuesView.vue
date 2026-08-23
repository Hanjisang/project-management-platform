<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { ElMessage } from 'element-plus';
import { issuesApi } from '../../api/issues.api';
import { projectsApi } from '../../api/projects.api';
import PageHeader from '../../components/PageHeader.vue';
import StatusTag from '../../components/StatusTag.vue';
const client = useQueryClient();
const dialog = ref(false);
const filters = reactive({ projectId: '', type: '', severity: '', status: '' });
const form = reactive({
  projectId: '',
  type: 'ISSUE',
  title: '',
  description: '',
  severity: 'MEDIUM',
  dueDate: '',
  probability: 3,
  impact: 3,
});
const projects = useQuery({
  queryKey: ['projects', 'issue-selector'],
  queryFn: () => projectsApi.list({ pageSize: 100 }),
});
const query = useQuery({
  queryKey: ['issues', filters],
  queryFn: () => issuesApi.list({ ...filters, pageSize: 100 }),
});
const create = useMutation({
  mutationFn: () =>
    issuesApi.create({
      ...form,
      dueDate: form.dueDate || undefined,
      probability: ['RISK', 'BLOCKER'].includes(form.type) ? form.probability : undefined,
      impact: ['RISK', 'BLOCKER'].includes(form.type) ? form.impact : undefined,
    }),
  onSuccess: async () => {
    ElMessage.success('问题或风险已创建');
    dialog.value = false;
    await client.invalidateQueries({ queryKey: ['issues'] });
  },
  onError: (error: Error) => ElMessage.error(error.message),
});
async function close(id: string): Promise<void> {
  try {
    await issuesApi.update(id, { status: 'CLOSED' });
    ElMessage.success('问题已关闭');
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
      ><el-button type="primary" @click="dialog = true">新增问题风险</el-button></PageHeader
    >
    <div class="filters">
      <div class="filter-row">
        <el-select
          v-model="filters.projectId"
          clearable
          filterable
          placeholder="项目"
          style="width: 230px"
          ><el-option
            v-for="project in projects.data.value?.items ?? []"
            :key="project.id"
            :label="project.name"
            :value="project.id" /></el-select
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
    <div class="panel table-wrap">
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
        /><el-table-column label="操作" width="100" fixed="right"
          ><template #default="scope"
            ><el-button
              v-if="!['RESOLVED', 'CLOSED'].includes(scope.row.status)"
              link
              type="success"
              @click="close(scope.row.id)"
              >关闭</el-button
            ></template
          ></el-table-column
        ></el-table
      >
    </div>
    <el-dialog v-model="dialog" title="新增问题或风险" width="min(620px,94vw)"
      ><el-form label-position="top"
        ><div class="content-grid">
          <el-form-item label="项目" required
            ><el-select v-model="form.projectId" filterable style="width: 100%"
              ><el-option
                v-for="project in projects.data.value?.items ?? []"
                :key="project.id"
                :label="project.name"
                :value="project.id" /></el-select></el-form-item
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
    >
  </div>
</template>
