<script setup lang="ts">
import { computed } from 'vue';
import { PROJECT_HEALTH_LABELS, PROJECT_STATUS_LABELS } from '@pmp/shared-constants';
const props = defineProps<{ value: string }>();
const labels: Record<string, string> = {
  ...PROJECT_STATUS_LABELS,
  ...PROJECT_HEALTH_LABELS,
  TODO: '待办',
  IN_PROGRESS: '进行中',
  BLOCKED: '已阻塞',
  DONE: '已完成',
  CANCELLED: '已取消',
  OPEN: '待处理',
  PROCESSING: '处理中',
  WAITING: '等待中',
  RESOLVED: '已解决',
  CLOSED: '已关闭',
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  PENDING_REVIEW: '待审核',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  RECEIVED: '已接收',
  ANALYZED: '已分析',
  PENDING_CONFIRMATION: '待确认',
  CONFIRMED: '已确认',
  FAILED: '失败',
  LOW: '低',
  MEDIUM: '中',
  HIGH: '高',
  CRITICAL: '紧急',
  URGENT: '紧急',
};
const type = computed(() =>
  ['HIGH_RISK', 'CRITICAL', 'URGENT', 'FAILED', 'BLOCKED', 'REJECTED'].includes(props.value)
    ? 'danger'
    : ['WARNING', 'HIGH', 'PENDING_REVIEW', 'PENDING_CONFIRMATION', 'PROCESSING'].includes(
          props.value,
        )
      ? 'warning'
      : ['NORMAL', 'DONE', 'COMPLETED', 'APPROVED', 'PUBLISHED', 'CONFIRMED', 'CLOSED'].includes(
            props.value,
          )
        ? 'success'
        : 'info',
);
</script>
<template>
  <el-tag :type="type" effect="light" size="small">{{ labels[value] ?? value }}</el-tag>
</template>
