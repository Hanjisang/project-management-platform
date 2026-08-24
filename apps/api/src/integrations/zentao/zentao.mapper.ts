import { Injectable } from '@nestjs/common';
import type { ProjectWorkItem } from '@prisma/client';

@Injectable()
export class ZentaoMapper {
  toExternal(task: ProjectWorkItem) {
    return {
      name: task.name,
      desc: task.description ?? '',
      pri: { LOW: 4, MEDIUM: 3, HIGH: 2, URGENT: 1 }[task.priority],
      estimate: 1,
      deadline: task.plannedEndDate?.toISOString().slice(0, 10) ?? null,
    };
  }
}
