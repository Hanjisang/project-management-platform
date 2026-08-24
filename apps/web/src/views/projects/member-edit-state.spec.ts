import { describe, expect, it } from 'vitest';
import { cloneMemberRows, type EditableMember } from './member-edit-state';

describe('member edit snapshots', () => {
  it('restores independent values when editing is cancelled', () => {
    const source: EditableMember[] = [{ userId: 'a', projectRole: 'IMPLEMENTER' }];
    const snapshot = cloneMemberRows(source);
    source[0]!.projectRole = 'VIEWER';
    expect(cloneMemberRows(snapshot)).toEqual([{ userId: 'a', projectRole: 'IMPLEMENTER' }]);
  });
});
