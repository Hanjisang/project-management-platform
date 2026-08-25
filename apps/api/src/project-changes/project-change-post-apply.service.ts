import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type CriterionInput = {
  id?: string;
  name: string;
  description?: string;
  required?: boolean;
  weight?: number;
};

type AcceptancePayload = {
  reason?: string;
  criteria?: CriterionInput[];
};

type AppliedChange = {
  id: string;
  projectId: string;
  operations?: Array<{
    operationType: string;
    entityId: string | null;
    payload: Prisma.JsonValue;
  }>;
};

@Injectable()
export class ProjectChangePostApplyService {
  constructor(private readonly prisma: PrismaService) {}

  async process(change: AppliedChange): Promise<void> {
    const operations = (change.operations ?? []).filter(
      (operation) => operation.operationType === 'CHANGE_ACCEPTANCE_CRITERIA' && operation.entityId,
    );
    for (const operation of operations) {
      const parsed = this.parsePayload(operation.payload);
      if (!parsed?.criteria) continue;
      await this.applyCriteria(change.projectId, change.id, operation.entityId!, parsed);
    }
  }

  private parsePayload(value: Prisma.JsonValue): AcceptancePayload | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const raw = value as Record<string, Prisma.JsonValue>;
    if (typeof raw.reason !== 'string') return null;
    try {
      const nested = JSON.parse(raw.reason) as AcceptancePayload;
      if (!nested || !Array.isArray(nested.criteria)) return null;
      return nested;
    } catch {
      return null;
    }
  }

  private async applyCriteria(
    projectId: string,
    changeId: string,
    deliverableId: string,
    payload: AcceptancePayload,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const deliverable = await tx.projectDeliverable.findFirst({
        where: { id: deliverableId, workItem: { projectId } },
        include: {
          reviewCriteria: {
            include: { _count: { select: { reviewResults: true } } },
            orderBy: { sortOrder: 'asc' },
          },
        },
      });
      if (!deliverable) return;

      const requestedIds = new Set(payload.criteria?.flatMap((item) => (item.id ? [item.id] : [])));
      let nextSortOrder =
        deliverable.reviewCriteria.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;

      for (const input of payload.criteria ?? []) {
        const normalized = {
          name: input.name.trim(),
          description: input.description?.trim() || null,
          required: input.required ?? true,
          weight: Math.max(0, Math.min(100, input.weight ?? 0)),
        };
        if (!normalized.name) continue;
        const existing = input.id
          ? deliverable.reviewCriteria.find((item) => item.id === input.id)
          : deliverable.reviewCriteria.find((item) => item.name === normalized.name);
        if (existing) {
          requestedIds.add(existing.id);
          await tx.projectDeliverableReviewCriterion.update({
            where: { id: existing.id },
            data: normalized,
          });
        } else {
          await tx.projectDeliverableReviewCriterion.create({
            data: {
              projectDeliverableId: deliverable.id,
              ...normalized,
              sortOrder: nextSortOrder++,
            },
          });
        }
      }

      for (const existing of deliverable.reviewCriteria) {
        if (requestedIds.has(existing.id)) continue;
        if (existing._count.reviewResults === 0) {
          await tx.projectDeliverableReviewCriterion.delete({ where: { id: existing.id } });
        } else {
          await tx.projectDeliverableReviewCriterion.update({
            where: { id: existing.id },
            data: {
              required: false,
              weight: 0,
              description: `${existing.description ?? ''}\n[由 ${changeId} 停用]`.trim(),
            },
          });
        }
      }

      await tx.projectDeliverable.update({
        where: { id: deliverable.id },
        data: {
          needsRevision: true,
          revisionReason: `${changeId}: ${payload.reason ?? '验收标准已变更'}`,
        },
      });
    });
  }
}
