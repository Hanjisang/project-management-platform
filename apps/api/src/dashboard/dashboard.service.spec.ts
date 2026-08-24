import { describe, expect, it, vi } from 'vitest';
import type { RequestUser } from '../common/types';
import type { ProjectScopeService } from '../auth/project-scope.service';
import type { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';

const user: RequestUser = {
  id: 'user-1',
  username: 'tester',
  displayName: 'Tester',
  permissions: [],
  isAdministrator: true,
};

describe('DashboardService parity', () => {
  it('returns a 20-row high-risk list without truncating the total count', async () => {
    const highRiskIssues = Array.from({ length: 20 }, (_, index) => ({
      id: `issue-${index}`,
      title: `Issue ${index}`,
      severity: 'HIGH',
      status: 'OPEN',
      project: { id: 'project-1', name: 'Project' },
    }));
    const issueCount = vi.fn().mockResolvedValue(21);
    const prisma = {
      project: { findMany: vi.fn().mockResolvedValue([]) },
      projectWorkItem: {
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      projectChecklistItem: { findMany: vi.fn().mockResolvedValue([]) },
      projectDeliverable: { findMany: vi.fn().mockResolvedValue([]) },
      projectChangeRequest: { findMany: vi.fn().mockResolvedValue([]) },
      issue: {
        findMany: vi.fn().mockResolvedValue(highRiskIssues),
        count: issueCount,
      },
      message: { count: vi.fn().mockResolvedValue(0) },
      user: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const scope = { where: vi.fn().mockReturnValue({}) } as unknown as ProjectScopeService;

    const result = await new DashboardService(prisma, scope).overview(user);

    expect(result.highRiskIssues).toHaveLength(20);
    expect(result.summary.highRiskIssueCount).toBe(21);
    expect(issueCount).toHaveBeenCalledTimes(1);
  });
});
