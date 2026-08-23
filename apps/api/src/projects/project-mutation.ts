import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, type ProjectStatus } from '@prisma/client';

export interface LockedProject {
  id: string;
  status: ProjectStatus;
  actualGoLiveDate: Date | null;
}

export async function lockProject(
  tx: Prisma.TransactionClient,
  projectId: string,
): Promise<LockedProject | null> {
  const rows = await tx.$queryRaw<LockedProject[]>(Prisma.sql`
    SELECT id, status, actual_go_live_date AS actualGoLiveDate
    FROM projects
    WHERE id = ${projectId} AND deleted_at IS NULL
    FOR UPDATE
  `);
  return rows[0] ?? null;
}

export async function assertProjectWritable(
  tx: Prisma.TransactionClient,
  projectId: string,
): Promise<LockedProject> {
  const project = await lockProject(tx, projectId);
  if (!project) throw new NotFoundException({ code: 'PROJECT_NOT_FOUND', message: '项目不存在' });
  if (['COMPLETED', 'CANCELLED'].includes(project.status))
    throw new ConflictException({
      code: 'PROJECT_READ_ONLY',
      message: '已结项或已取消的项目不允许新增执行数据',
      details: { status: project.status },
    });
  return project;
}
