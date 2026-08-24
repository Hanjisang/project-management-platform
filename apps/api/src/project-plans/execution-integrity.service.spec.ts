import { describe, expect, it, vi } from 'vitest';
import type { RequestUser } from '../common/types';
import type { PrismaService } from '../prisma/prisma.service';
import type { ProgressService } from './progress.service';
import { ExecutionIntegrityService } from './execution-integrity.service';

const manager: RequestUser = {
  id: 'manager-1',
  username: 'manager',
  displayName: 'Manager',
  permissions: [],
  isAdministrator: false,
};
const member: RequestUser = {
  id: 'member-1',
  username: 'member',
  displayName: 'Member',
  permissions: [],
  isAdministrator: false,
};

function serviceFixture(input?: {
  projectStatus?: string;
  customWorkItemCount?: number;
  workItemRequired?: boolean;
}) {
  const projectStatus = input?.projectStatus ?? 'NOT_STARTED';
  const prisma = {
    project: {
      findUnique: vi.fn().mockResolvedValue({
        status: projectStatus,
        managerUserId: manager.id,
        plannedStartDate: new Date('2026-09-01'),
        plannedGoLiveDate: new Date('2026-12-31'),
      }),
    },
    projectWorkItem: {
      count: vi.fn().mockResolvedValue(input?.customWorkItemCount ?? 0),
      findUnique: vi.fn().mockResolvedValue({
        required: input?.workItemRequired ?? false,
        project: { status: projectStatus, managerUserId: manager.id },
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
        plannedGoLiveDate: new Date('2027-01-15'),
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

  it('allows the project manager to create optional manual tasks but requires CR for required tasks', async () => {
    const service = serviceFixture({ projectStatus: 'ACTIVE' });
    await expect(
      service.assertDirectWorkItemCreationAllowed(manager, 'project-1', false),
    ).resolves.toBeUndefined();
    await expect(
      service.assertDirectWorkItemCreationAllowed(manager, 'project-1', true),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PROJECT_CHANGE_APPROVAL_REQUIRED' }),
    });
  });

  it('blocks non-managers from optional direct planning changes on active or paused projects', async () => {
    const service = serviceFixture({ projectStatus: 'PAUSED' });
    await expect(
      service.assertDirectWorkItemCreationAllowed(member, 'project-1', false),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PROJECT_CHANGE_MANAGER_REQUIRED' }),
    });
    await expect(
      service.assertDirectWorkItemUpdateAllowed(member, 'work-1', true),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PROJECT_CHANGE_MANAGER_REQUIRED' }),
    });
  });

  it('does not require manager ownership for execution-only status changes', async () => {
    const service = serviceFixture({ projectStatus: 'ACTIVE' });
    await expect(
      service.assertDirectWorkItemUpdateAllowed(member, 'work-1', false),
    ).resolves.toBeUndefined();
  });

  it('requires CR before cancelling a required work item on an active project', async () => {
    const service = serviceFixture({ projectStatus: 'ACTIVE', workItemRequired: true });
    await expect(
      service.assertDirectWorkItemCancellationAllowed(manager, 'work-1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PROJECT_CHANGE_APPROVAL_REQUIRED' }),
    });
  });

  it('allows only the manager to cancel optional work items on paused projects', async () => {
    const service = serviceFixture({ projectStatus: 'PAUSED', workItemRequired: false });
    await expect(
      service.assertDirectWorkItemCancellationAllowed(manager, 'work-1'),
    ).resolves.toBeUndefined();
    await expect(
      service.assertDirectWorkItemCancellationAllowed(member, 'work-1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PROJECT_CHANGE_MANAGER_REQUIRED' }),
    });
  });
});
