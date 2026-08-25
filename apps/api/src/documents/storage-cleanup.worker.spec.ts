import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import type { StorageProvider } from './storage.provider';
import { StorageCleanupWorker } from './storage-cleanup.worker';

function fixture(options?: { claimCount?: number; deleteError?: Error }) {
  const update = vi.fn().mockResolvedValue({});
  const prisma = {
    storageCleanupJob: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'job-1', objectKey: '2026/08/file.bin', attempts: 2 },
      ]),
      updateMany: vi.fn().mockResolvedValue({ count: options?.claimCount ?? 1 }),
      update,
    },
  } as unknown as PrismaService;
  const deleteObject = options?.deleteError
    ? vi.fn().mockRejectedValue(options.deleteError)
    : vi.fn().mockResolvedValue(undefined);
  const storage = {
    delete: deleteObject,
  } as unknown as StorageProvider;
  return { worker: new StorageCleanupWorker(prisma, storage), update, deleteObject };
}

describe('StorageCleanupWorker', () => {
  it('marks a claimed cleanup job completed after idempotent deletion', async () => {
    const { worker, update, deleteObject } = fixture();
    await worker.tick();
    expect(deleteObject).toHaveBeenCalledWith('2026/08/file.bin');
    expect(update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { completedAt: expect.any(Date), lastError: null },
    });
  });

  it('keeps a failed cleanup job pending with the latest error', async () => {
    const { worker, update } = fixture({ deleteError: new Error('storage unavailable') });
    await worker.tick();
    expect(update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { lastError: 'storage unavailable' },
    });
  });

  it('does not delete when another worker already claimed the same attempt', async () => {
    const { worker, deleteObject } = fixture({ claimCount: 0 });
    await worker.tick();
    expect(deleteObject).not.toHaveBeenCalled();
  });
});
