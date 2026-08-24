import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './client';
import { documentsApi } from './documents.api';
import { issuesApi } from './issues.api';
import { notificationsApi } from './notifications.api';
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
    await notificationsApi.list();
    await notificationsApi.read('notification-1');
    await projectsApi.updatePlanTask('plan-task-1', { plannedEndDate: '2026-08-31' });
    await sopApi.updateStage('stage-1', { name: '实施' });
    await sopApi.removeChecklist('check-1');

    expect(post).toHaveBeenCalledWith('/work-items/task-1/complete');
    expect(post).toHaveBeenCalledWith('/issues/issue-1/resolve');
    expect(post).toHaveBeenCalledWith('/issues/issue-1/close');
    expect(get).toHaveBeenCalledWith('/issues/issue-1');
    expect(post).toHaveBeenCalledWith('/documents/document-1/submit');
    expect(get).toHaveBeenCalledWith('/notifications');
    expect(patch).toHaveBeenCalledWith('/notifications/notification-1/read');
    expect(patch).toHaveBeenCalledWith('/work-items/plan-task-1', {
      plannedEndDate: '2026-08-31',
    });
    expect(patch).toHaveBeenCalledWith('/sop/stages/stage-1', { name: '实施' });
    expect(remove).toHaveBeenCalledWith('/sop/checklist-items/check-1');
  });

  it('uses multipart SOP template and project deliverable document endpoints', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { id: 'result' } });
    const remove = vi.spyOn(api, 'delete').mockResolvedValue({ data: undefined });
    const file = new File(['template'], 'template.txt', { type: 'text/plain' });
    await sopApi.uploadDeliverableTemplate('deliverable-1', file);
    await sopApi.removeDeliverableTemplate('template-1');
    const form = new FormData();
    form.set('file', file);
    form.set('name', '实际交付物');
    form.set('version', 'V1.0');
    await documentsApi.uploadForDeliverable('project-deliverable-1', form);

    expect(post).toHaveBeenCalledWith(
      '/sop/deliverables/deliverable-1/templates',
      expect.any(FormData),
      { headers: { 'content-type': 'multipart/form-data' } },
    );
    expect(remove).toHaveBeenCalledWith('/sop/deliverable-templates/template-1');
    expect(post).toHaveBeenCalledWith(
      '/project-deliverables/project-deliverable-1/documents',
      form,
      { headers: { 'content-type': 'multipart/form-data' } },
    );
    expect(sopApi.deliverableTemplateDownloadUrl('template-1')).toBe(
      '/api/v2/sop/deliverable-templates/template-1/download',
    );
    expect(projectsApi.deliverableTemplateDownloadUrl('snapshot-1')).toBe(
      '/api/v2/project-deliverable-templates/snapshot-1/download',
    );
  });
});
