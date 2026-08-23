<script setup lang="ts">
import { ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { projectsApi } from '../../api/projects.api';
import PageHeader from '../../components/PageHeader.vue';
import StatusTag from '../../components/StatusTag.vue';
const projectId = ref('');
const projects = useQuery({
  queryKey: ['projects', 'plan-selector'],
  queryFn: () => projectsApi.list({ pageSize: 100 }),
});
const plan = useQuery({
  queryKey: ['plan', projectId],
  queryFn: () => projectsApi.plan(projectId.value),
  enabled: () => Boolean(projectId.value),
  retry: false,
});
</script>
<template>
  <div>
    <PageHeader
      title="实施计划"
      description="项目计划是 SOP 版本的独立快照，检查项完成度逐层汇总进度"
    />
    <div class="filters">
      <el-select
        v-model="projectId"
        filterable
        placeholder="选择项目"
        style="width: min(420px, 100%)"
        ><el-option
          v-for="project in projects.data.value?.items ?? []"
          :key="project.id"
          :label="`${project.code} · ${project.name}`"
          :value="project.id"
      /></el-select>
    </div>
    <el-empty v-if="!projectId" description="请先选择项目" /><el-result
      v-else-if="plan.isError.value"
      icon="info"
      title="该项目尚未生成实施计划"
      ><template #extra
        ><router-link :to="`/projects/${projectId}`"
          ><el-button type="primary">前往项目详情</el-button></router-link
        ></template
      ></el-result
    >
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
