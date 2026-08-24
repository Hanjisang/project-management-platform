<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { projectsApi } from '../api/projects.api';

defineProps<{ modelValue: string; placeholder?: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const search = ref('');
let timer: ReturnType<typeof setTimeout> | undefined;
const query = useQuery({
  queryKey: computed(() => ['project-options', search.value]),
  queryFn: () => projectsApi.list({ search: search.value, page: 1, pageSize: 20 }),
});
function remote(value: string): void {
  clearTimeout(timer);
  timer = setTimeout(() => {
    search.value = value.trim();
  }, 250);
}
</script>

<template>
  <el-select
    :model-value="modelValue"
    clearable
    filterable
    remote
    :remote-method="remote"
    :loading="query.isFetching.value"
    :placeholder="placeholder ?? '搜索项目名称或编码'"
    style="width: 100%"
    @update:model-value="emit('update:modelValue', $event ?? '')"
  >
    <el-option
      v-for="project in query.data.value?.items ?? []"
      :key="project.id"
      :label="`${project.code} · ${project.name}`"
      :value="project.id"
    />
  </el-select>
</template>
