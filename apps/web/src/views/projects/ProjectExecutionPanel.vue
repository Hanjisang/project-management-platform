<script setup lang="ts">
import { computed, ref, toRef } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { projectsApi } from '../../api/projects.api';
import StatusTag from '../../components/StatusTag.vue';
import TaskExecutionDrawer from '../tasks/TaskExecutionDrawer.vue';
import type { PlanStage, ProjectWorkItem } from '../../types/domain';

const props = defineProps<{ projectId: string }>();
const projectId = toRef(props, 'projectId');
const drawer = ref(false);
const selectedId = ref('');
const execution = useQuery({
  queryKey: computed(() => ['project-execution', projectId.value]),
  queryFn: () =>
    projectsApi.execution(projectId.value) as Promise<{
      plan?: { progress: number };
      stages: PlanStage[];
      attentionCounts: Record<string, number>;
    }>,
});
function open(item: ProjectWorkItem): void {
  selectedId.value = item.id;
  drawer.value = true;
}
</script>

<template>
  <div class="execution-panel">
    <div class="attention-grid">
      <article>
        <span>逾期任务</span
        ><strong>{{ execution.data.value?.attentionCounts.overdueWorkItems ?? 0 }}</strong>
      </article>
      <article>
        <span>阻塞任务</span
        ><strong>{{ execution.data.value?.attentionCounts.blockedWorkItems ?? 0 }}</strong>
      </article>
      <article>
        <span>必交未上传</span
        ><strong>{{
          execution.data.value?.attentionCounts.unsubmittedRequiredDeliverables ?? 0
        }}</strong>
      </article>
      <article>
        <span>待审核</span
        ><strong>{{ execution.data.value?.attentionCounts.pendingReviews ?? 0 }}</strong>
      </article>
      <article>
        <span>待处理变更</span
        ><strong>{{ execution.data.value?.attentionCounts.pendingChanges ?? 0 }}</strong>
      </article>
    </div>
    <el-skeleton v-if="execution.isLoading.value" :rows="8" animated />
    <el-collapse v-else>
      <el-collapse-item
        v-for="stage in execution.data.value?.stages ?? []"
        :key="stage.id"
        :name="stage.id"
      >
        <template #title
          ><div class="stage-title">
            <strong>{{ stage.name }}</strong
            ><el-progress :percentage="stage.progress" :stroke-width="7" /></div
        ></template>
        <article
          v-for="item in stage.workItems"
          :key="item.id"
          class="work-item"
          @click="open(item)"
        >
          <div>
            <el-tag
              size="small"
              :type="
                item.sourceType === 'SOP'
                  ? 'primary'
                  : item.sourceType === 'CHANGE'
                    ? 'warning'
                    : 'info'
              "
              >{{ item.sourceType }}</el-tag
            ><strong>{{ item.name }}</strong>
          </div>
          <span>{{ item.owner?.displayName ?? '未分配' }}</span>
          <span
            >Checklist {{ item.checklistSummary?.completed ?? 0 }}/{{
              item.checklistSummary?.total ?? 0
            }}</span
          >
          <span
            >交付物 {{ item.deliverableSummary?.approved ?? 0 }}/{{
              item.deliverableSummary?.total ?? 0
            }}</span
          >
          <el-progress :percentage="item.progress" :stroke-width="7" />
          <StatusTag :value="item.status" />
        </article>
      </el-collapse-item>
    </el-collapse>
    <el-empty
      v-if="!execution.isLoading.value && !execution.data.value?.stages.length"
      description="尚无执行计划"
    />
    <TaskExecutionDrawer v-model="drawer" :task-id="selectedId" />
  </div>
</template>

<style scoped>
.attention-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(110px, 1fr));
  gap: 10px;
  margin: 8px 0 18px;
}
.attention-grid article {
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-muted);
}
.attention-grid span {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.attention-grid strong {
  display: block;
  margin-top: 6px;
  font-size: 24px;
}
.stage-title {
  display: grid;
  grid-template-columns: 1fr minmax(160px, 280px);
  align-items: center;
  gap: 16px;
  width: 100%;
  padding-right: 16px;
}
.work-item {
  display: grid;
  grid-template-columns: minmax(220px, 2fr) repeat(4, minmax(90px, 1fr)) 90px;
  gap: 12px;
  align-items: center;
  padding: 12px;
  margin-bottom: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
}
.work-item:hover {
  border-color: var(--el-color-primary);
}
.work-item strong {
  margin-left: 8px;
}
@media (max-width: 900px) {
  .attention-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .work-item {
    grid-template-columns: 1fr 110px;
  }
  .work-item > span {
    display: none;
  }
}
</style>
