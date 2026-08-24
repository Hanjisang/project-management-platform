import { BadRequestException } from '@nestjs/common';
import type { TaskStatus } from '@prisma/client';

export function assertTaskDates(plannedStartDate?: Date, dueDate?: Date): void {
  if (plannedStartDate && dueDate && plannedStartDate > dueDate)
    throw new BadRequestException({
      code: 'TASK_DATE_INVALID',
      message: '计划开始日期不能晚于截止日期',
    });
}

export function normalizeTaskUpdate(
  existing: { status: TaskStatus; progress: number },
  update: { status?: TaskStatus; progress?: number },
): { progress?: number; completedAt?: null } {
  if (update.status === 'DONE' || update.progress === 100)
    throw new BadRequestException({
      code: 'TASK_COMPLETE_ACTION_REQUIRED',
      message: '请使用完成任务操作将任务进度设为 100%',
    });
  if (existing.status === 'DONE' && update.progress !== undefined && update.status === undefined)
    throw new BadRequestException({
      code: 'TASK_REOPEN_STATUS_REQUIRED',
      message: '修改已完成任务的进度时必须同时选择新的状态',
    });
  const reopening = existing.status === 'DONE' && update.status !== undefined;
  return {
    progress: reopening ? Math.min(update.progress ?? existing.progress, 99) : update.progress,
    completedAt: update.status ? null : undefined,
  };
}
