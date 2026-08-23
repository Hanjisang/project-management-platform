import type { SopDiffItem } from '@pmp/shared-types';

interface ChecklistLike {
  id: string;
  stableKey?: string;
  sourceItemKey?: string | null;
  name: string;
  sortOrder: number;
  required: boolean;
}
interface TaskLike {
  id: string;
  stableKey?: string;
  sourceTaskKey?: string | null;
  name: string;
  description: string | null;
  sortOrder: number;
  weight: number;
  required: boolean;
  deliverableRequired: boolean;
  deliverableName: string | null;
  checklistItems: ChecklistLike[];
}
interface StageLike {
  id: string;
  stableKey?: string;
  sourceStageKey?: string | null;
  name: string;
  description: string | null;
  sortOrder: number;
  weight: number;
  tasks: TaskLike[];
}

function changed(before: Record<string, unknown>, after: Record<string, unknown>): boolean {
  return JSON.stringify(before) !== JSON.stringify(after);
}

export function buildPlanDiff(
  currentStages: StageLike[],
  targetStages: StageLike[],
): SopDiffItem[] {
  const diff: SopDiffItem[] = [];
  const currentStageMap = new Map(
    currentStages.filter((item) => item.sourceStageKey).map((item) => [item.sourceStageKey!, item]),
  );
  const targetStageMap = new Map(targetStages.map((item) => [item.stableKey!, item]));
  for (const target of targetStages) {
    const current = currentStageMap.get(target.stableKey!);
    const after = {
      name: target.name,
      description: target.description,
      sortOrder: target.sortOrder,
      weight: target.weight,
    };
    if (!current)
      diff.push({
        operation: 'ADD',
        entity: 'STAGE',
        sourceId: target.id,
        planId: null,
        path: target.name,
        before: null,
        after,
      });
    else {
      const before = {
        name: current.name,
        description: current.description,
        sortOrder: current.sortOrder,
        weight: current.weight,
      };
      if (changed(before, after))
        diff.push({
          operation: 'MODIFY',
          entity: 'STAGE',
          sourceId: target.id,
          planId: current.id,
          path: target.name,
          before,
          after,
        });
    }
    const currentTasks = new Map(
      (current?.tasks ?? [])
        .filter((item) => item.sourceTaskKey)
        .map((item) => [item.sourceTaskKey!, item]),
    );
    const targetTasks = new Map(target.tasks.map((item) => [item.stableKey!, item]));
    for (const targetTask of target.tasks) {
      const currentTask = currentTasks.get(targetTask.stableKey!);
      const taskAfter = {
        name: targetTask.name,
        description: targetTask.description,
        sortOrder: targetTask.sortOrder,
        weight: targetTask.weight,
        required: targetTask.required,
        deliverableRequired: targetTask.deliverableRequired,
        deliverableName: targetTask.deliverableName,
      };
      if (!currentTask)
        diff.push({
          operation: 'ADD',
          entity: 'TASK',
          sourceId: targetTask.id,
          planId: null,
          path: `${target.name}/${targetTask.name}`,
          before: null,
          after: taskAfter,
        });
      else {
        const taskBefore = {
          name: currentTask.name,
          description: currentTask.description,
          sortOrder: currentTask.sortOrder,
          weight: currentTask.weight,
          required: currentTask.required,
          deliverableRequired: currentTask.deliverableRequired,
          deliverableName: currentTask.deliverableName,
        };
        if (changed(taskBefore, taskAfter))
          diff.push({
            operation: 'MODIFY',
            entity: 'TASK',
            sourceId: targetTask.id,
            planId: currentTask.id,
            path: `${target.name}/${targetTask.name}`,
            before: taskBefore,
            after: taskAfter,
          });
      }
      const currentItems = new Map(
        (currentTask?.checklistItems ?? [])
          .filter((item) => item.sourceItemKey)
          .map((item) => [item.sourceItemKey!, item]),
      );
      const targetItems = new Map(targetTask.checklistItems.map((item) => [item.stableKey!, item]));
      for (const targetItem of targetTask.checklistItems) {
        const currentItem = currentItems.get(targetItem.stableKey!);
        const itemAfter = {
          name: targetItem.name,
          sortOrder: targetItem.sortOrder,
          required: targetItem.required,
        };
        if (!currentItem)
          diff.push({
            operation: 'ADD',
            entity: 'CHECKLIST',
            sourceId: targetItem.id,
            planId: null,
            path: `${target.name}/${targetTask.name}/${targetItem.name}`,
            before: null,
            after: itemAfter,
          });
        else {
          const itemBefore = {
            name: currentItem.name,
            sortOrder: currentItem.sortOrder,
            required: currentItem.required,
          };
          if (changed(itemBefore, itemAfter))
            diff.push({
              operation: 'MODIFY',
              entity: 'CHECKLIST',
              sourceId: targetItem.id,
              planId: currentItem.id,
              path: `${target.name}/${targetTask.name}/${targetItem.name}`,
              before: itemBefore,
              after: itemAfter,
            });
        }
      }
      for (const [key, currentItem] of currentItems)
        if (!targetItems.has(key))
          diff.push({
            operation: 'REMOVE',
            entity: 'CHECKLIST',
            sourceId: null,
            planId: currentItem.id,
            path: `${target.name}/${targetTask.name}/${currentItem.name}`,
            before: { name: currentItem.name },
            after: null,
          });
    }
    for (const [key, currentTask] of currentTasks)
      if (!targetTasks.has(key))
        diff.push({
          operation: 'REMOVE',
          entity: 'TASK',
          sourceId: null,
          planId: currentTask.id,
          path: `${target.name}/${currentTask.name}`,
          before: { name: currentTask.name },
          after: null,
        });
  }
  for (const [key, current] of currentStageMap)
    if (!targetStageMap.has(key))
      diff.push({
        operation: 'REMOVE',
        entity: 'STAGE',
        sourceId: null,
        planId: current.id,
        path: current.name,
        before: { name: current.name },
        after: null,
      });
  return diff;
}
