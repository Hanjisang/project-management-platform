<script setup lang="ts">
import { computed } from 'vue';
import { canRetryQuery, queryErrorMessage, queryErrorTitle } from './query-state';

const props = defineProps<{ error: unknown; title?: string }>();
const emit = defineEmits<{ retry: [] }>();
const resolvedTitle = computed(() => queryErrorTitle(props.error, props.title ?? '数据加载失败'));
const message = computed(() => queryErrorMessage(props.error));
const retryable = computed(() => canRetryQuery(props.error));
</script>

<template>
  <el-result icon="error" :title="resolvedTitle" :sub-title="message">
    <template v-if="retryable" #extra>
      <el-button type="primary" @click="emit('retry')">重试</el-button>
    </template>
  </el-result>
</template>
