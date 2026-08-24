import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import type { ProgressService } from './progress.service';
import { ExecutionIntegrityService } from './execution-integrity.service';

function serviceFixture(input?: {
  projectStatus?: string;
  customWorkItemCount?: number;
  workItemRequired?: boolean;
}) {
  const prisma = {
    project: {
      findUnique: vi.fn().mockResolvedValue(
        input?.projectStatus ? { status: input.projectStatus } : { status: 'NOT_STARTED' },
      ),
    },
    projectWorkItem: {
      count: vi.fn().mockResolvedValue(input?.customWorkItemCount ?? 0),
      findUnique: vi.fn().mockResolvedValue({
        required: input?.workItemRequired ?? false,
        project: { status: input?.projectStatus ?? 'NOT_STARTED' },
      }),
    },
  } as unknown as PrismaService;
  const progress = {} as ProgressService;
  return new ExecutionIntegrityService(prisma, progress);
}

describe('ExecutionIntegrityService', () => {
  it('blocks baseline date edits on active projects', async () => {
    const service = serviceFixture({ projectStatus: 'ACTIVE' });
    await expect(
      service.assertProjectDateUpdateAllowed('project-1', {
        plannedGoLiveDate: new Date('2026-12-01'),
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PROJECT_CHANGE_APPROVAL_REQUIRED' }),
    });
  });

  it('allows ordinary project metadata edits when dates are untouched', async () => {
    const service = serviceFixture({ projectStatus: 'ACTIVE' });
    await expect(service.assertProjectDateUpdateAllowed('project-1', {})).resolves.toBeUndefined();
  });

  it('blocks destructive SOP sync when custom work items exist', async () => {
    const service = serviceFixture({ customWorkItemCount: 1 });
    await expect(service.assertSafeDirectSopSync('project-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SOP_SYNC_CUSTOM_WORK_ITEMS_PRESENT' }),
    });
  });

  it('allows optional manual tasks but requires CR for required tasks in active projects', async () => {
    const service = serviceFixture({ projectStatus: 'ACTIVE' });
    await expect(
      service.assertDirectWorkItemCreationAllowed('project-1', false),
    ).resolves.toBeUndefined();
    await expect(
      service.assertDirectWorkItemCreationAllowed('project-1', true),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PROJECT_CHANGE_APPROVAL_REQUIRED' }),
    });
  });

  it('requires CR before cancelling a required work item on an active project', async () => {
    const service = serviceFixture({ projectStatus: 'ACTIVE', workItemRequired: true });
    await expect(service.assertDirectWorkItemCancellationAllowed('work-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PROJECT_CHANGE_APPROVAL_REQUIRED' }),
    });
  });
});
