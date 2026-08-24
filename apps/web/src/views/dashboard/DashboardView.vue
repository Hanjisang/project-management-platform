<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { dashboardApi } from '../../api/dashboard.api';
import PageHeader from '../../components/PageHeader.vue';
import StatusTag from '../../components/StatusTag.vue';
const query = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get });
const metrics = [
  ['projectCount', '项目总数', '可访问项目'],
  ['NORMAL', '正常项目', '实施节奏正常'],
  ['WARNING', '预警项目', '需要关注'],
  ['HIGH_RISK', '高风险项目', '需要立即介入'],
  ['overdueTaskCount', '逾期任务', '尚未完成'],
  ['pendingSopTaskCount', '待完成 SOP Task', '计划自动生成的主任务'],
  ['overdueChecklistCount', 'Checklist 逾期', '必需检查项未完成'],
  ['requiredDeliverableNotSubmittedCount', '待提交必交资料', '尚未上传文档'],
  ['pendingDeliverableReviewCount', '待审核交付物', '已提交等待审核'],
  ['pendingMessageCount', '待确认消息', 'AI 不会直接入库'],
] as const;
</script>
<template>
  <div>
    <PageHeader
      title="管理驾驶舱"
      description="所有指标均已应用当前用户的项目数据权限"
    /><el-skeleton v-if="query.isLoading.value" :rows="8" animated /><el-result
      v-else-if="query.isError.value"
      icon="error"
      title="驾驶舱加载失败"
      sub-title="请检查 API 与数据库连接"
      ><template #extra
        ><el-button type="primary" @click="query.refetch()">重试</el-button></template
      ></el-result
    ><template v-else-if="query.data.value"
      ><section class="metric-grid">
        <article v-for="[key, label, hint] in metrics" :key="key" class="metric-card">
          <div class="metric-label">{{ label }}</div>
          <div class="metric-value">{{ query.data.value.summary[key] ?? 0 }}</div>
          <div class="metric-hint">{{ hint }}</div>
        </article>
      </section>
      <section class="content-grid">
        <article class="panel">
          <div class="panel-header"><h3>项目进度排行</h3></div>
          <div class="panel-body">
            <div
              v-for="project in query.data.value.progressRanking"
              :key="project.id"
              style="margin-bottom: 14px"
            >
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px">
                <router-link :to="`/projects/${project.id}`">{{ project.name }}</router-link
                ><span>{{ project.progress }}%</span>
              </div>
              <el-progress :percentage="project.progress" :stroke-width="8" />
            </div>
            <el-empty
              v-if="!query.data.value.progressRanking.length"
              description="暂无项目"
              :image-size="72"
            />
          </div>
        </article>
        <article class="panel">
          <div class="panel-header"><h3>人员任务负荷</h3></div>
          <div class="table-wrap">
            <el-table :data="query.data.value.workload" empty-text="暂无进行中任务"
              ><el-table-column prop="displayName" label="人员" min-width="120" /><el-table-column
                prop="activeTaskCount"
                label="活跃任务"
                width="100" /><el-table-column label="平均进度" min-width="150"
                ><template #default="scope"
                  ><el-progress
                    :percentage="scope.row.averageProgress" /></template></el-table-column
            ></el-table>
          </div>
        </article>
        <article class="panel">
          <div class="panel-header">
            <h3>逾期任务</h3>
            <router-link to="/tasks">查看全部</router-link>
          </div>
          <div class="table-wrap">
            <el-table :data="query.data.value.overdueTasks" empty-text="无逾期任务"
              ><el-table-column prop="title" label="任务" min-width="180" /><el-table-column
                prop="project.name"
                label="项目"
                min-width="140" /><el-table-column prop="dueDate" label="截止日期" width="120"
            /></el-table>
          </div>
        </article>
        <article class="panel">
          <div class="panel-header">
            <h3>高风险问题</h3>
            <router-link to="/issues">查看全部</router-link>
          </div>
          <div class="table-wrap">
            <el-table :data="query.data.value.highRiskIssues" empty-text="无高风险问题"
              ><el-table-column prop="title" label="问题" min-width="180" /><el-table-column
                prop="project.name"
                label="项目"
                min-width="140" /><el-table-column label="等级" width="90"
                ><template #default="scope"
                  ><StatusTag :value="scope.row.severity" /></template></el-table-column
            ></el-table>
          </div>
        </article></section
    ></template>
  </div>
</template>
