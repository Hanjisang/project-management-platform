import { ForbiddenException } from '@nestjs/common';
import { PERMISSIONS } from '@pmp/shared-constants';
import { describe, expect, it, vi } from 'vitest';
import type { RequestUser } from './types';
import type { WorkItemsService } from '../work-items/work-items.service';
import type { ExecutionIntegrityService } from '../project-plans/execution-integrity.service';
import { WorkItemsController } from '../work-items/work-items.controller';
import { IssuesController } from '../issues/issues.controller';
import { PERMISSIONS_ANY_KEY, PERMISSIONS_KEY } from './decorators';

function actionPermissions(target: object, method: string): string[] {
  const handler = Object.getOwnPropertyDescriptor(target, method)?.value as object;
  return Reflect.getMetadata(PERMISSIONS_KEY, handler) as string[];
}

function anyPermissions(target: object, method: string): string[] {
  const handler = Object.getOwnPropertyDescriptor(target, method)?.value as object;
  return Reflect.getMetadata(PERMISSIONS_ANY_KEY, handler) as string[];
}

const planEditor: RequestUser = {
  id: 'planner-1',
  username: 'planner',
  displayName: 'Planner',
  permissions: [PERMISSIONS.PLAN_EDIT],
  isAdministrator: false,
};

describe('business action permission metadata', () => {
  it('requires task.complete on the completion endpoint', () => {
    expect(actionPermissions(WorkItemsController.prototype, 'complete')).toEqual([
      PERMISSIONS.TASK_COMPLETE,
    ]);
  });

  it('keeps plan editing compatible with work-item planning and checklist endpoints', () => {
    expect(anyPermissions(WorkItemsController.prototype, 'update')).toEqual([
      PERMISSIONS.TASK_EDIT,
      PERMISSIONS.PLAN_EDIT,
    ]);
    expect(anyPermissions(WorkItemsController.prototype, 'checklist')).toEqual([
      PERMISSIONS.TASK_EDIT,
      PERMISSIONS.PLAN_EDIT,
    ]);
  });

  it('limits PLAN_EDIT-only users to owner and schedule fields', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'work-item-1' });
    const assertDirectWorkItemUpdateAllowed = vi.fn().mockResolvedValue(undefined);
    const controller = new WorkItemsController(
      { update } as unknown as WorkItemsService,
      { assertDirectWorkItemUpdateAllowed } as unknown as ExecutionIntegrityService,
    );

    await expect(
      controller.update(planEditor, 'work-item-1', {
        ownerUserId: 'owner-1',
        plannedStartDate: new Date('2026-08-01'),
        plannedEndDate: new Date('2026-08-10'),
      }),
    ).resolves.toEqual({ id: 'work-item-1' });
    expect(update).toHaveBeenCalledTimes(1);

    await expect(
      controller.update(planEditor, 'work-item-1', { name: 'should be forbidden' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('separates issue edit, resolve and close permissions', () => {
    expect(actionPermissions(IssuesController.prototype, 'update')).toEqual([
      PERMISSIONS.ISSUE_EDIT,
    ]);
    expect(actionPermissions(IssuesController.prototype, 'resolve')).toEqual([
      PERMISSIONS.ISSUE_EDIT,
    ]);
    expect(actionPermissions(IssuesController.prototype, 'close')).toEqual([
      PERMISSIONS.ISSUE_CLOSE,
    ]);
  });
});
