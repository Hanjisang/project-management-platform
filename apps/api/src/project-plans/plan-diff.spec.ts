import { describe, expect, it } from 'vitest';
import { buildPlanDiff } from './plan-diff';

describe('SOP plan diff', () => {
  it('detects stage, task and checklist additions, modifications and removals', () => {
    const current = [
      {
        id: 'ps1',
        sourceStageKey: 'stage-a',
        name: 'A',
        description: null,
        sortOrder: 0,
        weight: 100,
        tasks: [
          {
            id: 'pt1',
            sourceTaskKey: 'task-a',
            name: 'Old task',
            description: null,
            sortOrder: 0,
            weight: 100,
            required: true,
            deliverableRequired: false,
            deliverableName: null,
            checklistItems: [
              {
                id: 'pc1',
                sourceItemKey: 'check-old',
                name: 'Old check',
                sortOrder: 0,
                required: true,
              },
            ],
          },
        ],
      },
      {
        id: 'ps-removed',
        sourceStageKey: 'stage-removed',
        name: 'Removed stage',
        description: null,
        sortOrder: 1,
        weight: 0,
        tasks: [],
      },
    ];
    const target = [
      {
        id: 's2',
        stableKey: 'stage-a',
        name: 'A modified',
        description: null,
        sortOrder: 0,
        weight: 100,
        tasks: [
          {
            id: 't2',
            stableKey: 'task-a',
            name: 'New task',
            description: null,
            sortOrder: 0,
            weight: 50,
            required: true,
            deliverableRequired: false,
            deliverableName: null,
            checklistItems: [
              {
                id: 'c-modified',
                stableKey: 'check-old',
                name: 'Modified check',
                sortOrder: 0,
                required: false,
              },
              { id: 'c2', stableKey: 'check-new', name: 'New check', sortOrder: 1, required: true },
            ],
          },
          {
            id: 't3',
            stableKey: 'task-b',
            name: 'Added',
            description: null,
            sortOrder: 1,
            weight: 50,
            required: true,
            deliverableRequired: false,
            deliverableName: null,
            checklistItems: [],
          },
        ],
      },
      {
        id: 's-added',
        stableKey: 'stage-added',
        name: 'Added stage',
        description: null,
        sortOrder: 1,
        weight: 0,
        tasks: [],
      },
    ];
    const diff = buildPlanDiff(current, target);
    expect(new Set(diff.map((item) => `${item.operation}:${item.entity}`))).toEqual(
      new Set([
        'ADD:STAGE',
        'MODIFY:STAGE',
        'REMOVE:STAGE',
        'ADD:TASK',
        'MODIFY:TASK',
        'ADD:CHECKLIST',
        'MODIFY:CHECKLIST',
      ]),
    );
  });

  it('detects task and checklist removals inside a retained stage', () => {
    const current = [
      {
        id: 'stage-plan',
        sourceStageKey: 'stage',
        name: 'Stage',
        description: null,
        sortOrder: 0,
        weight: 100,
        tasks: [
          {
            id: 'task-plan',
            sourceTaskKey: 'task',
            name: 'Task',
            description: null,
            sortOrder: 0,
            weight: 100,
            required: true,
            deliverableRequired: false,
            deliverableName: null,
            checklistItems: [
              {
                id: 'check-plan',
                sourceItemKey: 'check',
                name: 'Check',
                sortOrder: 0,
                required: true,
              },
            ],
          },
          {
            id: 'task-removed-plan',
            sourceTaskKey: 'task-removed',
            name: 'Removed task',
            description: null,
            sortOrder: 1,
            weight: 0,
            required: true,
            deliverableRequired: false,
            deliverableName: null,
            checklistItems: [],
          },
        ],
      },
    ];
    const target = [
      {
        id: 'stage-source',
        stableKey: 'stage',
        name: 'Stage',
        description: null,
        sortOrder: 0,
        weight: 100,
        tasks: [
          {
            id: 'task-source',
            stableKey: 'task',
            name: 'Task',
            description: null,
            sortOrder: 0,
            weight: 100,
            required: true,
            deliverableRequired: false,
            deliverableName: null,
            checklistItems: [],
          },
        ],
      },
    ];

    const diff = buildPlanDiff(current, target);
    expect(diff.map((item) => `${item.operation}:${item.entity}`)).toEqual(
      expect.arrayContaining(['REMOVE:TASK', 'REMOVE:CHECKLIST']),
    );
  });
});
