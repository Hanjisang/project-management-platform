import type { ProjectRole } from '@pmp/shared-types';

export interface EditableMember {
  userId: string;
  projectRole: ProjectRole;
}

export function cloneMemberRows(rows: EditableMember[]): EditableMember[] {
  return rows.map((item) => ({ ...item }));
}
