<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { ElMessage } from 'element-plus';
import { projectsApi } from '../../api/projects.api';
import { reportsApi } from '../../api/reports.api';
import PageHeader from '../../components/PageHeader.vue';
const client = useQueryClient();
const dailyDialog = ref(false);
const weeklyDialog = ref(false);
const projectId = ref('');
const daily = reactive({
  projectId: '',
  reportDate: '',
  completed: '',
  risks: '',
  coordination: '',
  tomorrow: '',
  notes: '',
});
const weekly = reactive({ projectId: '', department: '', weekStart: '', weekEnd: '' });
const projects = useQuery({
  queryKey: ['projects', 'report-selector'],
  queryFn: () => projectsApi.list({ pageSize: 100 }),
});
const dailyList = useQuery({
  queryKey: ['daily-reports', projectId],
  queryFn: () => reportsApi.daily(projectId.value ? { projectId: projectId.value } : undefined),
});
const weeklyList = useQuery({ queryKey: ['weekly-reports'], queryFn: reportsApi.weekly });
const lines = (value: string) =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
const saveDaily = useMutation({
  mutationFn: () =>
    reportsApi.upsertDaily({
      ...daily,
      completed: lines(daily.completed),
      risks: lines(daily.risks),
      coordination: lines(daily.coordination),
      tomorrow: lines(daily.tomorrow),
    }),
  onSuccess: async () => {
    ElMessage.success('日报已提交');
    dailyDialog.value = false;
    await client.invalidateQueries({ queryKey: ['daily-reports'] });
  },
  onError: (error: Error) => ElMessage.error(error.message),
});
const generate = useMutation({
  mutationFn: () =>
    reportsApi.generateWeekly({
      ...weekly,
      projectId: weekly.projectId || undefined,
      department: weekly.department || undefined,
    }),
  onSuccess: async () => {
    ElMessage.success('周报基础数据已聚合');
    weeklyDialog.value = false;
    await client.invalidateQueries({ queryKey: ['weekly-reports'] });
  },
  onError: (error: Error) => ElMessage.error(error.message),
});
</script>
<template>
  <div>
    <PageHeader
      title="日报周报"
      description="周报从任务、问题风险、项目计划、日报和消息聚合基础数据"
      ><el-button @click="weeklyDialog = true">生成周报</el-button
      ><el-button type="primary" @click="dailyDialog = true">填写日报</el-button></PageHeader
    ><el-tabs
      ><el-tab-pane label="日报"
        ><div class="filters">
          <el-select
            v-model="projectId"
            clearable
            filterable
            placeholder="按项目筛选"
            style="width: 260px"
            ><el-option
              v-for="project in projects.data.value?.items ?? []"
              :key="project.id"
              :label="project.name"
              :value="project.id"
          /></el-select>
        </div>
        <div class="panel table-wrap">
          <el-table :data="dailyList.data.value ?? []"
            ><el-table-column prop="reportDate" label="日期" width="130" /><el-table-column
              prop="project.name"
              label="项目"
              min-width="160"
            /><el-table-column
              prop="reporter.displayName"
              label="汇报人"
              width="120"
            /><el-table-column label="已完成" min-width="260"
              ><template #default="scope">{{
                Array.isArray(scope.row.completed) ? scope.row.completed.join('；') : '-'
              }}</template></el-table-column
            ><el-table-column label="风险" min-width="200"
              ><template #default="scope">{{
                Array.isArray(scope.row.risks) ? scope.row.risks.join('；') : '-'
              }}</template></el-table-column
            ></el-table
          >
        </div></el-tab-pane
      ><el-tab-pane label="周报"
        ><div class="panel table-wrap">
          <el-table :data="weeklyList.data.value ?? []"
            ><el-table-column prop="weekStart" label="周期开始" width="130" /><el-table-column
              prop="weekEnd"
              label="周期结束"
              width="130" /><el-table-column
              prop="project.name"
              label="项目"
              min-width="180" /><el-table-column
              prop="department"
              label="部门"
              min-width="140" /><el-table-column
              prop="creator.displayName"
              label="生成人"
              width="120"
          /></el-table></div></el-tab-pane></el-tabs
    ><el-dialog v-model="dailyDialog" title="填写项目日报" width="min(680px,94vw)"
      ><el-form label-position="top"
        ><div class="content-grid">
          <el-form-item label="项目" required
            ><el-select v-model="daily.projectId" filterable style="width: 100%"
              ><el-option
                v-for="project in projects.data.value?.items ?? []"
                :key="project.id"
                :label="project.name"
                :value="project.id" /></el-select></el-form-item
          ><el-form-item label="汇报日期" required
            ><el-date-picker
              v-model="daily.reportDate"
              value-format="YYYY-MM-DD"
              type="date"
              style="width: 100%"
          /></el-form-item>
        </div>
        <el-form-item label="今日完成（每行一项）"
          ><el-input v-model="daily.completed" type="textarea" :rows="3" /></el-form-item
        ><el-form-item label="风险与问题"
          ><el-input v-model="daily.risks" type="textarea" :rows="3" /></el-form-item
        ><el-form-item label="需协调事项"
          ><el-input v-model="daily.coordination" type="textarea" :rows="3" /></el-form-item
        ><el-form-item label="明日计划"
          ><el-input v-model="daily.tomorrow" type="textarea" :rows="3" /></el-form-item></el-form
      ><template #footer
        ><el-button @click="dailyDialog = false">取消</el-button
        ><el-button
          type="primary"
          :disabled="!daily.projectId || !daily.reportDate"
          :loading="saveDaily.isPending.value"
          @click="saveDaily.mutate()"
          >提交</el-button
        ></template
      ></el-dialog
    ><el-dialog v-model="weeklyDialog" title="生成周报基础数据" width="min(560px,94vw)"
      ><el-form label-position="top"
        ><el-form-item label="项目（留空表示部门汇总）"
          ><el-select v-model="weekly.projectId" clearable filterable style="width: 100%"
            ><el-option
              v-for="project in projects.data.value?.items ?? []"
              :key="project.id"
              :label="project.name"
              :value="project.id" /></el-select></el-form-item
        ><el-form-item label="部门"><el-input v-model.trim="weekly.department" /></el-form-item>
        <div class="content-grid">
          <el-form-item label="开始日期" required
            ><el-date-picker
              v-model="weekly.weekStart"
              value-format="YYYY-MM-DD"
              type="date"
              style="width: 100%" /></el-form-item
          ><el-form-item label="结束日期" required
            ><el-date-picker
              v-model="weekly.weekEnd"
              value-format="YYYY-MM-DD"
              type="date"
              style="width: 100%"
          /></el-form-item></div></el-form
      ><template #footer
        ><el-button @click="weeklyDialog = false">取消</el-button
        ><el-button
          type="primary"
          :disabled="!weekly.weekStart || !weekly.weekEnd"
          :loading="generate.isPending.value"
          @click="generate.mutate()"
          >生成</el-button
        ></template
      ></el-dialog
    >
  </div>
</template>
