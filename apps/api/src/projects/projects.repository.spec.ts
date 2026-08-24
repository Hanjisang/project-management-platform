import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import type { DeliverableReviewDecisionService } from '../documents/deliverable-review-decision.service';
import { ProjectsRepository } from './projects.repository';

describe('ProjectsRepository closure parity', () => {
  it('includes only non-approved ordinary required documents in close blockers', async () => {
    const requiredDocuments = [
      { id: 'doc-draft', name: '上线方案', status: 'DRAFT' },
      { id: 'doc-review', name: '培训记录', status: 'PENDING_REVIEW' },
      { id: 'doc-rejected', name: '确认函', status: 'REJECTED' },
    ];
    const documentFindMany = vi.fn().mockResolvedValue(requiredDocuments);
    const tx = {
      projectWorkItem: { findMany: vi.fn().mockResolvedValue([]) },
      issue: { findMany: vi.fn().mockResolvedValue([]) },
      document: { findMany: documentFindMany },
      projectDeliverable: { findMany: vi.fn().mockResolvedValue([]) },
      projectChangeRequest: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const prisma = {
      $transaction: vi.fn().mockImplementation(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const deliverables = {
      decide: vi.fn(),
    } as unknown as DeliverableReviewDecisionService;

    const result = await new ProjectsRepository(prisma, deliverables).closureBlockers('project-1');

    expect(result.missingRequiredDocuments).toEqual(requiredDocuments);
    expect(documentFindMany).toHaveBeenCalledWith({
      where: {
        projectId: 'project-1',
        required: true,
        deletedAt: null,
        projectDeliverableId: null,
        status: { not: 'APPROVED' },
      },
      select: { id: true, name: true, status: true },
      orderBy: { createdAt: 'asc' },
    });
  });
});
