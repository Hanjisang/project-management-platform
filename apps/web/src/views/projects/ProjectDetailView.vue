<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { ElMessage, ElMessageBox } from 'element-plus';
import { projectsApi } from '../../api/projects.api';
import { tasksApi } from '../../api/tasks.api';
import { issuesApi } from '../../api/issues.api';
import { messagesApi } from '../../api/messages.api';
import { reportsApi } from '../../api/reports.api';
import StatusTag from '../../components/StatusTag.vue';
import ProjectPlanPanel from './ProjectPlanPanel.vue';
import ProjectMembersPanel from './ProjectMembersPanel.vue';
import ProjectDocumentsPanel from './ProjectDocumentsPanel.vue';
const route = useRoute();
const projectId = String(route.params.id);
const tab = ref(sessionStorage.getItem(`pmp:project-tab:${projectId}`) ?? 'overview');
const client = useQueryClient();
const project = useQuery({
  queryKey: ['project', projectId],
  queryFn: () => projectsApi.get(projectId),
});
const tasks = useQuery({
  queryKey: ['tasks', projectId],
  queryFn: () => tasksApi.list({ projectId, pageSize: 100 }),
});
const issues = useQuery({
  queryKey: ['issues', projectId],
  queryFn: () => issuesApi.list({ projectId, pageSize: 100 }),
});
const messages = useQuery({
  queryKey: ['messages', projectId],
  queryFn: () => messagesApi.list({ projectId, pageSize: 100 }),
});
const reports = useQuery({
  queryKey: ['daily-reports', projectId],
  queryFn: () => reportsApi.daily({ projectId }),
});
const lifecycle = useMutation({
  mutationFn: (action: 'start' | 'pause' | 'resume' | 'close') =>
    projectsApi.action(projectId, action),
  onSuccess: async () => {
    ElMessage.success('项目状态已更新');
    await client.invalidateQueries({ queryKey: ['project', projectId] });
    await client.invalidateQueries({ queryKey: ['projects'] });
  },
  onError: (error: Error) => ElMessage.error(error.message),
});
async function action(value: 'start' | 'pause' | 'resume' | 'close'): Promise<void> {
  if (value === 'close')
    await ElMessageBox.confirm('后端将校验计划、任务、高优问题与必需交付物。', '确认项目结项', {
      type: 'warning',
    });
  lifecycle.mutate(value);
}
function changeTab(value: string | number): void {
  sessionStorage.setItem(`pmp:project-tab:${projectId}`, String(value));
}
</script>
<template>
  <div>
    <el-skeleton v-if="project.isLoading.value" :rows="8" animated /><el-result
      v-else-if="project.isError.value"
      icon="error"
      title="项目加载失败"
    /><template v-else-if="project.data.value"
      ><section class="detail-hero">
        <div>
          <div>
            <el-tag effect="plain">{{ project.data.value.code }}</el-tag>
            <StatusTag :value="project.data.value.health" />
          </div>
          <h2>{{ project.data.value.name }}</h2>
          <div class="detail-meta">
            <span>客户：{{ project.data.value.customerName }}</span
            ><span>负责人：{{ project.data.value.manager.displayName }}</span
            ><span>计划上线：{{ project.data.value.plannedGoLiveDate?.slice(0, 10) ?? '-' }}</span>
          </div>
        </div>
        <div class="toolbar-actions">
          <StatusTag :value="project.data.value.status" /><el-button
            v-if="project.data.value.status === 'NOT_STARTED'"
            type="primary"
            @click="action('start')"
            >启动项目</el-button
          ><el-button v-if="project.data.value.status === 'ACTIVE'" @click="action('pause')"
            >暂停</el-button
          ><el-button
            v-if="project.data.value.status === 'PAUSED'"
            type="primary"
            @click="action('resume')"
            >恢复</el-button
          ><el-button
            v-if="['ACTIVE', 'PAUSED'].includes(project.data.value.status)"
            type="success"
            @click="action('close')"
            >项目结项</el-button
          >
        </div>
      </section>
      <el-tabs v-model="tab" class="panel" style="padding: 0 16px 16px" @tab-change="changeTab"
        ><el-tab-pane label="概览" name="overview"
          ><div
            class="metric-grid"
            style="grid-template-columns: repeat(4, minmax(130px, 1fr)); padding-top: 8px"
          >
            <article class="metric-card">
              <div class="metric-label">项目进度</div>
              <div class="metric-value">{{ project.data.value.progress }}%</div>
              <el-progress :percentage="project.data.value.progress" :show-text="false" />
            </article>
            <article class="metric-card">
              <div class="metric-label">执行任务</div>
              <div class="metric-value">{{ project.data.value._count?.tasks ?? 0 }}</div>
            </article>
            <article class="metric-card">
              <div class="metric-label">问题风险</div>
              <div class="metric-value">{{ project.data.value._count?.issues ?? 0 }}</div>
            </article>
            <article class="metric-card">
              <div class="metric-label">项目成员</div>
              <div class="metric-value">{{ project.data.value.members?.length ?? 0 }}</div>
            </article>
          </div>
          <div class="panel-body">
            <h3>项目说明</h3>
            <p class="muted">{{ project.data.value.description || '暂无说明' }}</p>
          </div></el-tab-pane
        ><el-tab-pane label="实施计划" name="plan"
          ><ProjectPlanPanel :project-id="projectId" /></el-tab-pane
        ><el-tab-pane label="任务" name="tasks"
          ><div class="table-wrap">
            <el-table :data="tasks.data.value?.items ?? []"
              ><el-table-column prop="title" label="任务" min-width="200" /><el-table-column
                prop="owner.displayName"
                label="负责人"
                width="120" /><el-table-column label="状态" width="100"
                ><template #default="scope"
                  ><StatusTag :value="scope.row.status" /></template></el-table-column
              ><el-table-column prop="dueDate" label="截止日期" width="120"
            /></el-table></div></el-tab-pane
        ><el-tab-pane label="问题风险" name="issues"
          ><div class="table-wrap">
            <el-table :data="issues.data.value?.items ?? []"
              ><el-table-column prop="title" label="问题" min-width="200" /><el-table-column
                prop="type"
                label="类型"
                width="100" /><el-table-column label="等级" width="100"
                ><template #default="scope"
                  ><StatusTag :value="scope.row.severity" /></template></el-table-column
              ><el-table-column label="状态" width="100"
                ><template #default="scope"
                  ><StatusTag :value="scope.row.status" /></template></el-table-column
            ></el-table></div></el-tab-pane
        ><el-tab-pane label="交付物" name="documents"
          ><ProjectDocumentsPanel :project-id="projectId" /></el-tab-pane
        ><el-tab-pane label="项目消息" name="messages"
          ><div class="table-wrap">
            <el-table :data="messages.data.value?.items ?? []"
              ><el-table-column prop="receivedAt" label="时间" width="180" /><el-table-column
                prop="senderName"
                label="发送人"
                width="120" /><el-table-column
                prop="content"
                label="内容"
                min-width="300"
                show-overflow-tooltip /><el-table-column label="状态" width="120"
                ><template #default="scope"
                  ><StatusTag :value="scope.row.status" /></template></el-table-column
            ></el-table></div></el-tab-pane
        ><el-tab-pane label="日报周报" name="reports"
          ><div class="table-wrap">
            <el-table :data="reports.data.value ?? []"
              ><el-table-column prop="reportDate" label="日期" width="130" /><el-table-column
                prop="reporter.displayName"
                label="汇报人"
                width="120"
              /><el-table-column label="已完成" min-width="260"
                ><template #default="scope">{{
                  Array.isArray(scope.row.completed) ? scope.row.completed.join('；') : '-'
                }}</template></el-table-column
              ></el-table
            >
          </div></el-tab-pane
        ><el-tab-pane label="项目成员" name="members"
          ><ProjectMembersPanel :project-id="projectId" /></el-tab-pane
        ><el-tab-pane label="操作日志" name="audit"
          ><el-empty
            description="项目写操作已记入全局审计日志，请在系统管理中检索" /></el-tab-pane></el-tabs
    ></template>
  </div>
</template>
