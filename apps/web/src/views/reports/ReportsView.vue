<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { ElMessage } from 'element-plus';
import { reportsApi } from '../../api/reports.api';
import PageHeader from '../../components/PageHeader.vue';
import RemoteProjectSelect from '../../components/RemoteProjectSelect.vue';
import ApiErrorView from '../../components/ApiErrorView.vue';
import { PERMISSIONS } from '@pmp/shared-constants';
import { useAuthStore } from '../../stores/auth';
const client = useQueryClient();
const dailyDialog = ref(false);
const weeklyDialog = ref(false);
const weeklyDetail = ref<Record<string, unknown> | null>(null);
const auth = useAuthStore();
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
function resetDailyForm(): void {
  Object.assign(daily, {
    projectId: '',
    reportDate: '',
    completed: '',
    risks: '',
    coordination: '',
    tomorrow: '',
    notes: '',
  });
}
function resetWeeklyForm(): void {
  Object.assign(weekly, { projectId: '', department: '', weekStart: '', weekEnd: '' });
}
const dailyList = useQuery({
  queryKey: computed(() => ['daily-reports', projectId.value]),
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
    resetDailyForm();
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
    resetWeeklyForm();
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
      ><el-button v-if="auth.has(PERMISSIONS.REPORT_SUBMIT)" @click="weeklyDialog = true"
        >生成周报</el-button
      ><el-button
        v-if="auth.has(PERMISSIONS.REPORT_SUBMIT)"
        type="primary"
        @click="dailyDialog = true"
        >填写日报</el-button
      ></PageHeader
    ><el-tabs
      ><el-tab-pane label="日报"
        ><div class="filters">
          <RemoteProjectSelect v-model="projectId" placeholder="按项目筛选" style="width: 260px" />
        </div>
        <ApiErrorView
          v-if="dailyList.isError.value"
          :error="dailyList.error.value"
          title="日报加载失败"
          @retry="dailyList.refetch()"
        />
        <div v-else class="panel table-wrap">
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
        ><ApiErrorView
          v-if="weeklyList.isError.value"
          :error="weeklyList.error.value"
          title="周报加载失败"
          @retry="weeklyList.refetch()" />
        <div v-else class="panel table-wrap">
          <el-table
            :data="weeklyList.data.value ?? []"
            @row-click="(row: Record<string, unknown>) => (weeklyDetail = row)"
            ><el-table-column prop="weekStart" label="周期开始" width="130" /><el-table-column
              prop="weekEnd"
              label="周期结束"
              width="130" /><el-table-column
              prop="project.name"
              label="项目"
              min-width="180" /><el-table-column
              prop="department"
              label="报告标签"
              min-width="140" /><el-table-column
              prop="creator.displayName"
              label="生成人"
              width="120"
          /></el-table></div></el-tab-pane></el-tabs
    ><el-dialog
      v-model="dailyDialog"
      title="填写项目日报"
      width="min(680px,94vw)"
      destroy-on-close
      @closed="resetDailyForm"
      ><el-form label-position="top"
        ><div class="content-grid">
          <el-form-item label="项目" required
            ><RemoteProjectSelect v-model="daily.projectId" /></el-form-item
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
          ><el-input v-model="daily.tomorrow" type="textarea" :rows="3" /></el-form-item
        ><el-form-item label="备注"
          ><el-input v-model="daily.notes" type="textarea" :rows="2" /></el-form-item></el-form
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
    ><el-dialog
      v-model="weeklyDialog"
      title="生成周报基础数据"
      width="min(560px,94vw)"
      destroy-on-close
      @closed="resetWeeklyForm"
      ><el-form label-position="top"
        ><el-form-item label="项目（留空表示汇总当前用户有权访问的全部项目）"
          ><RemoteProjectSelect v-model="weekly.projectId" /></el-form-item
        ><el-form-item label="报告标签（不参与数据过滤）"
          ><el-input v-model.trim="weekly.department"
        /></el-form-item>
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
    ><el-dialog
      :model-value="Boolean(weeklyDetail)"
      title="周报生成快照"
      width="min(780px,94vw)"
      @close="weeklyDetail = null"
    >
      <pre style="white-space: pre-wrap; max-height: 60vh; overflow: auto">{{
        JSON.stringify(weeklyDetail?.content ?? {}, null, 2)
      }}</pre>
    </el-dialog>
  </div>
</template>
