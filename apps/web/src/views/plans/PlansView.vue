<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { projectsApi } from '../../api/projects.api';
import PageHeader from '../../components/PageHeader.vue';
import StatusTag from '../../components/StatusTag.vue';
import RemoteProjectSelect from '../../components/RemoteProjectSelect.vue';
import { projectQueryKey } from '../../composables/project-query';
import { ApiError } from '../../api/client';
const projectId = ref('');
const plan = useQuery({
  queryKey: projectQueryKey('plan', projectId),
  queryFn: () => projectsApi.plan(projectId.value),
  enabled: () => Boolean(projectId.value),
  retry: false,
});
const planMissing = computed(
  () => plan.error.value instanceof ApiError && plan.error.value.code === 'PROJECT_PLAN_NOT_FOUND',
);
const planErrorTitle = computed(() => {
  if (plan.error.value instanceof ApiError && plan.error.value.status === 403)
    return '无权查看该项目计划';
  return '实施计划加载失败';
});
</script>
<template>
  <div>
    <PageHeader
      title="实施计划"
      description="项目计划是 SOP 版本的独立快照，检查项完成度逐层汇总进度"
    />
    <div class="filters">
      <RemoteProjectSelect
        v-model="projectId"
        placeholder="选择项目"
        style="width: min(420px, 100%)"
      />
    </div>
    <el-empty v-if="!projectId" description="请先选择项目" /><el-result
      v-else-if="plan.isError.value && planMissing"
      icon="info"
      title="该项目尚未生成实施计划"
      ><template #extra
        ><router-link :to="`/projects/${projectId}`"
          ><el-button type="primary">前往项目详情</el-button></router-link
        ></template
      ></el-result
    >
    <el-result v-else-if="plan.isError.value" icon="error" :title="planErrorTitle">
      <template #extra>
        <el-button type="primary" @click="plan.refetch()">重试</el-button>
      </template>
    </el-result>
    <div v-else-if="plan.data.value" class="panel">
      <div class="panel-header">
        <div>
          <h3>{{ plan.data.value.name }}</h3>
          <span class="muted">总进度 {{ plan.data.value.progress }}%</span>
        </div>
        <router-link :to="`/projects/${projectId}`">管理计划</router-link>
      </div>
      <div class="panel-body">
        <article v-for="stage in plan.data.value.stages" :key="stage.id" class="plan-stage">
          <div class="plan-stage-header">
            <strong>{{ stage.name }}</strong
            ><span>{{ stage.progress }}% · 权重 {{ stage.weight }}%</span>
          </div>
          <div v-for="task in stage.tasks" :key="task.id" class="plan-task">
            <div style="display: flex; justify-content: space-between; gap: 12px">
              <span>{{ task.name }}</span
              ><StatusTag :value="task.progress === 100 ? 'DONE' : 'IN_PROGRESS'" />
            </div>
            <el-progress :percentage="task.progress" :stroke-width="7" />
          </div>
        </article>
      </div>
    </div>
  </div>
</template>
