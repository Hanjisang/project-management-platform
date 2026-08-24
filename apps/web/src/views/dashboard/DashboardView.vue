<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { dashboardApi } from '../../api/dashboard.api';
import PageHeader from '../../components/PageHeader.vue';
import StatusTag from '../../components/StatusTag.vue';

const query = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get });
const projectScope = ref<'ALL' | 'MANAGED' | 'PARTICIPATED'>('ALL');
const attentionOnly = ref(false);
const myProjects = computed(() =>
  (query.data.value?.myProjects ?? []).filter((project) => {
    if (projectScope.value === 'MANAGED' && !project.isManager) return false;
    if (projectScope.value === 'PARTICIPATED' && project.isManager) return false;
    if (
      attentionOnly.value &&
      project.health === 'NORMAL' &&
      project.overdueCount === 0 &&
      project.blockedCount === 0 &&
      project.unsubmittedRequiredDeliverables === 0 &&
      project.pendingReviewCount === 0 &&
      project.pendingChangeCount === 0
    )
      return false;
    return true;
  }),
);
const metrics = [
  ['projectCount', '项目总数', '可访问项目'],
  ['WARNING', '预警项目', '需要关注'],
  ['HIGH_RISK', '高风险项目', '需要立即介入'],
  ['overdueTaskCount', '逾期任务', '尚未完成'],
  ['requiredDeliverableNotSubmittedCount', '待提交必交资料', '尚未上传文档'],
  ['pendingDeliverableReviewCount', '待人工审核', '已上传等待审核'],
] as const;
</script>

<template>
  <div>
    <PageHeader title="管理驾驶舱" description="我的项目优先展示自己负责或参与项目的执行状态与异常事项" />
    <el-skeleton v-if="query.isLoading.value" :rows="10" animated />
    <el-result
      v-else-if="query.isError.value"
      icon="error"
      title="工作台加载失败"
      sub-title="请检查 API 与数据库连接"
    >
      <template #extra><el-button type="primary" @click="query.refetch()">重试</el-button></template>
    </el-result>
    <template v-else-if="query.data.value">
      <div class="project-filters">
        <el-segmented
          v-model="projectScope"
          :options="[
            { label: '全部项目', value: 'ALL' },
            { label: '我负责的', value: 'MANAGED' },
            { label: '我参与的', value: 'PARTICIPATED' },
          ]"
        />
        <el-checkbox v-model="attentionOnly">只看需要关注</el-checkbox>
      </div>

      <section class="my-project-grid">
        <router-link
          v-for="project in myProjects"
          :key="project.id"
          :to="{ path: `/projects/${project.id}`, query: { tab: 'execution' } }"
          class="project-card"
        >
          <div class="project-card-head">
            <div>
              <div class="project-code">{{ project.code }} · {{ project.isManager ? '我负责' : '我参与' }}</div>
              <h3>{{ project.name }}</h3>
            </div>
            <div class="project-tags">
              <StatusTag :value="project.health" />
              <StatusTag :value="project.status" />
            </div>
          </div>
          <div class="project-stage">当前阶段：<strong>{{ project.currentStage }}</strong></div>
          <div class="progress-row">
            <el-progress :percentage="project.progress" :stroke-width="9" />
            <strong>{{ project.progress }}%</strong>
          </div>
          <div class="execution-facts">
            <span>任务 <b>{{ project.workItems.done }}/{{ project.workItems.total }}</b></span>
            <span>检查项 <b>{{ project.checklist.done }}/{{ project.checklist.total }}</b></span>
            <span>必交资料 <b>{{ project.deliverables.approved }}/{{ project.deliverables.total }}</b></span>
          </div>
          <div class="attention-row">
            <el-tag v-if="project.overdueCount" type="danger" size="small">逾期 {{ project.overdueCount }}</el-tag>
            <el-tag v-if="project.blockedCount" type="danger" size="small">阻塞 {{ project.blockedCount }}</el-tag>
            <el-tag v-if="project.unsubmittedRequiredDeliverables" type="warning" size="small">未提交 {{ project.unsubmittedRequiredDeliverables }}</el-tag>
            <el-tag v-if="project.pendingReviewCount" type="warning" size="small">待审核 {{ project.pendingReviewCount }}</el-tag>
            <el-tag v-if="project.pendingChangeCount" type="info" size="small">待处理变更 {{ project.pendingChangeCount }}</el-tag>
            <span
              v-if="
                !project.overdueCount &&
                !project.blockedCount &&
                !project.unsubmittedRequiredDeliverables &&
                !project.pendingReviewCount &&
                !project.pendingChangeCount
              "
              class="normal-text"
            >暂无异常</span>
          </div>
          <div class="project-date">计划完成：{{ project.plannedGoLiveDate?.slice(0, 10) ?? '-' }}</div>
        </router-link>
        <el-empty v-if="!myProjects.length" description="当前筛选条件下没有项目" />
      </section>

      <h2 class="section-heading">管理概览</h2>
      <section class="metric-grid">
        <article v-for="[key, label, hint] in metrics" :key="key" class="metric-card">
          <div class="metric-label">{{ label }}</div>
          <div class="metric-value">{{ query.data.value.summary[key] ?? 0 }}</div>
          <div class="metric-hint">{{ hint }}</div>
        </article>
      </section>

      <section class="content-grid">
        <article class="panel">
          <div class="panel-header"><h3>人员任务负荷</h3></div>
          <div class="table-wrap">
            <el-table :data="query.data.value.workload" empty-text="暂无进行中任务">
              <el-table-column prop="displayName" label="人员" min-width="120" />
              <el-table-column prop="activeTaskCount" label="活跃任务" width="100" />
              <el-table-column label="平均进度" min-width="150">
                <template #default="scope"><el-progress :percentage="scope.row.averageProgress" /></template>
              </el-table-column>
            </el-table>
          </div>
        </article>
        <article class="panel">
          <div class="panel-header">
            <h3>逾期任务</h3>
            <router-link to="/tasks">查看全部</router-link>
          </div>
          <div class="table-wrap">
            <el-table :data="query.data.value.overdueTasks" empty-text="无逾期任务">
              <el-table-column prop="name" label="任务" min-width="180" />
              <el-table-column prop="project.name" label="项目" min-width="140" />
              <el-table-column label="截止日期" width="120">
                <template #default="scope">{{ scope.row.plannedEndDate?.slice(0, 10) ?? '-' }}</template>
              </el-table-column>
            </el-table>
          </div>
        </article>
        <article class="panel">
          <div class="panel-header">
            <h3>高风险问题</h3>
            <router-link to="/issues">查看全部</router-link>
          </div>
          <div class="table-wrap">
            <el-table :data="query.data.value.highRiskIssues" empty-text="无高风险问题">
              <el-table-column prop="title" label="问题" min-width="180" />
              <el-table-column prop="project.name" label="项目" min-width="140" />
              <el-table-column label="等级" width="90">
                <template #default="scope"><StatusTag :value="scope.row.severity" /></template>
              </el-table-column>
            </el-table>
          </div>
        </article>
      </section>
    </template>
  </div>
</template>

<style scoped>
.project-filters { display: flex; justify-content: space-between; align-items: center; gap: 14px; margin-bottom: 14px; }
.my-project-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 14px; }
.project-card { display: block; padding: 16px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); color: inherit; text-decoration: none; transition: border-color .15s ease, transform .15s ease; }
.project-card:hover { border-color: var(--el-color-primary); transform: translateY(-1px); }
.project-card-head, .progress-row, .execution-facts, .attention-row { display: flex; align-items: center; gap: 10px; }
.project-card-head { justify-content: space-between; align-items: flex-start; }
.project-card h3 { margin: 4px 0 0; font-size: 17px; }
.project-code, .project-date, .project-stage, .normal-text { color: var(--el-text-color-secondary); font-size: 12px; }
.project-tags { display: flex; gap: 6px; }
.project-stage { margin-top: 14px; }
.progress-row { margin-top: 10px; }
.progress-row .el-progress { flex: 1; }
.execution-facts { justify-content: space-between; margin-top: 14px; padding: 10px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); font-size: 13px; }
.attention-row { min-height: 28px; flex-wrap: wrap; margin-top: 12px; }
.project-date { margin-top: 8px; text-align: right; }
.section-heading { margin: 24px 0 12px; font-size: 17px; }
@media (max-width: 700px) {
  .project-filters { align-items: flex-start; flex-direction: column; }
  .my-project-grid { grid-template-columns: 1fr; }
  .execution-facts { align-items: flex-start; flex-direction: column; }
}
</style>
