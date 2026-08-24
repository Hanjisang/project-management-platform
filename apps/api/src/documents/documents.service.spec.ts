import { describe, expect, it, vi } from 'vitest';
import type { RequestUser } from '../common/types';
import type { ProjectScopeService } from '../auth/project-scope.service';
import type { PrismaService } from '../prisma/prisma.service';
import { DocumentsService } from './documents.service';
import type { StorageProvider } from './storage.provider';
import type { ProgressService } from '../project-plans/progress.service';

const user: RequestUser = {
  id: 'user-id',
  username: 'user',
  displayName: 'User',
  permissions: [],
  isAdministrator: false,
};
const file = {
  originalname: 'acceptance.txt',
  mimetype: 'text/plain',
  size: 10,
  buffer: Buffer.from('acceptance'),
} as Express.Multer.File;
const progress = { recomputePlanTask: vi.fn() } as unknown as ProgressService;

describe('DocumentsService storage consistency', () => {
  it('deletes the stored object when the database transaction fails', async () => {
    const databaseError = new Error('database insert failed');
    const deleteObject = vi.fn().mockResolvedValue(undefined);
    const prisma = {
      $transaction: vi.fn().mockRejectedValue(databaseError),
      projectPlanTask: { count: vi.fn() },
      storageCleanupJob: { upsert: vi.fn() },
    } as unknown as PrismaService;
    const storage = {
      put: vi
        .fn()
        .mockResolvedValue({ objectKey: '2026/acceptance.txt', size: 10n, checksum: 'sum' }),
      delete: deleteObject,
    } as unknown as StorageProvider;
    const scope = {
      assert: vi.fn().mockResolvedValue(undefined),
    } as unknown as ProjectScopeService;

    await expect(
      new DocumentsService(prisma, scope, progress, storage).create(
        user,
        'project-id',
        { name: 'Acceptance', version: 'V1.0' },
        file,
      ),
    ).rejects.toBe(databaseError);
    expect(deleteObject).toHaveBeenCalledWith('2026/acceptance.txt');
  });

  it('records a cleanup job when database deletion succeeds but file deletion fails', async () => {
    const cleanup = vi.fn().mockResolvedValue({});
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'project-id', status: 'ACTIVE' }]),
      documentVersion: {
        findMany: vi.fn().mockResolvedValue([{ objectKey: '2026/orphan.txt' }]),
      },
      document: { update: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      document: {
        findFirst: vi.fn().mockResolvedValue({ id: 'document-id', projectId: 'project-id' }),
      },
      $transaction: vi
        .fn()
        .mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx)),
      storageCleanupJob: { upsert: cleanup },
    } as unknown as PrismaService;
    const storage = {
      delete: vi.fn().mockRejectedValue(new Error('storage unavailable')),
    } as unknown as StorageProvider;
    const scope = {
      assert: vi.fn().mockResolvedValue(undefined),
    } as unknown as ProjectScopeService;

    await expect(
      new DocumentsService(prisma, scope, progress, storage).remove(user, 'document-id'),
    ).resolves.toBeUndefined();
    expect(cleanup).toHaveBeenCalledWith({
      where: { objectKey: '2026/orphan.txt' },
      create: expect.objectContaining({
        objectKey: '2026/orphan.txt',
        reason: 'document:document-id',
        lastError: 'storage unavailable',
      }),
      update: expect.objectContaining({ lastError: 'storage unavailable' }),
    });
  });

  it('does not allow DRAFT documents to be reviewed directly', async () => {
    const prisma = {
      document: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'document-id',
          projectId: 'project-id',
          status: 'DRAFT',
        }),
      },
    } as unknown as PrismaService;
    const scope = { assert: vi.fn() } as unknown as ProjectScopeService;
    const storage = {} as StorageProvider;
    await expect(
      new DocumentsService(prisma, scope, progress, storage).review(user, 'document-id', {
        status: 'APPROVED',
      }),
    ).rejects.toMatchObject({ response: { code: 'DOCUMENT_REVIEW_STATE_INVALID' } });
  });

  it('submits DRAFT to PENDING_REVIEW inside the project write guard', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'document-id', status: 'PENDING_REVIEW' });
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'project-id', status: 'ACTIVE' }]),
      document: { update },
    };
    const prisma = {
      document: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'document-id',
          projectId: 'project-id',
          status: 'DRAFT',
        }),
      },
      $transaction: vi
        .fn()
        .mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const scope = { assert: vi.fn() } as unknown as ProjectScopeService;
    await new DocumentsService(prisma, scope, progress, {} as StorageProvider).submit(
      user,
      'document-id',
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: 'document-id' },
      data: { status: 'PENDING_REVIEW' },
    });
  });
});
