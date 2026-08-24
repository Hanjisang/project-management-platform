import { PERMISSIONS } from '@pmp/shared-constants';
import { describe, expect, it } from 'vitest';
import { WorkItemsController } from '../work-items/work-items.controller';
import { IssuesController } from '../issues/issues.controller';
import { PERMISSIONS_KEY } from './decorators';

function actionPermissions(target: object, method: string): string[] {
  const handler = Object.getOwnPropertyDescriptor(target, method)?.value as object;
  return Reflect.getMetadata(PERMISSIONS_KEY, handler) as string[];
}

describe('business action permission metadata', () => {
  it('requires task.complete on the completion endpoint', () => {
    expect(actionPermissions(WorkItemsController.prototype, 'complete')).toEqual([
      PERMISSIONS.TASK_COMPLETE,
    ]);
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
