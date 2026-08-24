import { computed, toValue, type MaybeRefOrGetter } from 'vue';

export function projectQueryKey(scope: string, projectId: MaybeRefOrGetter<string>) {
  return computed(() => [scope, toValue(projectId)] as const);
}
