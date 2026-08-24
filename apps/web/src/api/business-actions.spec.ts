import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './client';
import { documentsApi } from './documents.api';
import { issuesApi } from './issues.api';
import { projectsApi } from './projects.api';
import { sopApi } from './sop.api';
import { tasksApi } from './tasks.api';

describe('business action API contracts', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('calls dedicated state-action and CRUD endpoints', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { id: 'result' } });
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: { id: 'result' } });
    const remove = vi.spyOn(api, 'delete').mockResolvedValue({ data: undefined });
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: { id: 'issue-1' } });

    await tasksApi.complete('task-1');
    await issuesApi.resolve('issue-1');
    await issuesApi.close('issue-1');
    await issuesApi.get('issue-1');
    await documentsApi.submit('document-1');
    await projectsApi.updatePlanTask('plan-task-1', { plannedEndDate: '2026-08-31' });
    await sopApi.updateStage('stage-1', { name: '实施' });
    await sopApi.removeChecklist('check-1');

    expect(post).toHaveBeenCalledWith('/tasks/task-1/complete');
    expect(post).toHaveBeenCalledWith('/issues/issue-1/resolve');
    expect(post).toHaveBeenCalledWith('/issues/issue-1/close');
    expect(get).toHaveBeenCalledWith('/issues/issue-1');
    expect(post).toHaveBeenCalledWith('/documents/document-1/submit');
    expect(patch).toHaveBeenCalledWith('/plan-tasks/plan-task-1', {
      plannedEndDate: '2026-08-31',
    });
    expect(patch).toHaveBeenCalledWith('/sop/stages/stage-1', { name: '实施' });
    expect(remove).toHaveBeenCalledWith('/sop/checklist-items/check-1');
  });
});
