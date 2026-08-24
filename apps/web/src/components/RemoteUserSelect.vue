<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { projectsApi } from '../api/projects.api';
defineProps<{ modelValue: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const search = ref('');
let timer: ReturnType<typeof setTimeout> | undefined;
const query = useQuery({
  queryKey: computed(() => ['project-user-options', search.value]),
  queryFn: () => projectsApi.userOptions({ search: search.value, page: 1, pageSize: 20 }),
});
function remote(value: string): void {
  clearTimeout(timer);
  timer = setTimeout(() => (search.value = value.trim()), 250);
}
</script>
<template>
  <el-select
    :model-value="modelValue"
    filterable
    remote
    :remote-method="remote"
    :loading="query.isFetching.value"
    style="width: 100%"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-option
      v-for="user in query.data.value?.items ?? []"
      :key="user.id"
      :label="`${user.displayName} (${user.username})`"
      :value="user.id"
    />
  </el-select>
</template>
