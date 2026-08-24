import { ref } from 'vue';
import { describe, expect, it } from 'vitest';
import { projectQueryKey } from './project-query';

describe('projectQueryKey', () => {
  it('changes when route or prop project id changes without a remount', () => {
    const projectId = ref('project-a');
    const key = projectQueryKey('tasks', projectId);
    expect(key.value).toEqual(['tasks', 'project-a']);
    projectId.value = 'project-b';
    expect(key.value).toEqual(['tasks', 'project-b']);
  });
});
