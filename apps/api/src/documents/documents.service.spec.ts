import { describe, expect, it, vi } from 'vitest';
import type { RequestUser } from '../common/types';
import type { ProjectScopeService } from '../auth/project-scope.service';
import type { PrismaService } from '../prisma/prisma.service';
import { DocumentsService } from './documents.service';
import type { StorageProvider } from './storage.provider';

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
      new DocumentsService(prisma, scope, storage).create(
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
      new DocumentsService(prisma, scope, storage).remove(user, 'document-id'),
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
});
