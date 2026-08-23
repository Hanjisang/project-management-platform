import { Injectable } from '@nestjs/common';
import type { Task } from '@prisma/client';

@Injectable()
export class ZentaoMapper {
  toExternal(task: Task) {
    return {
      name: task.title,
      desc: task.description ?? '',
      pri: { LOW: 4, MEDIUM: 3, HIGH: 2, URGENT: 1 }[task.priority],
      estimate: 1,
      deadline: task.dueDate?.toISOString().slice(0, 10) ?? null,
    };
  }
}
