import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_PROVIDER, type StorageProvider } from './storage.provider';

const CLEANUP_INTERVAL_MS = 60_000;
const MAX_ATTEMPTS = 10;
const BATCH_SIZE = 10;

@Injectable()
export class StorageCleanupWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), CLEANUP_INTERVAL_MS);
    this.timer.unref();
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const jobs = await this.prisma.storageCleanupJob.findMany({
        where: { completedAt: null, attempts: { lt: MAX_ATTEMPTS } },
        orderBy: { updatedAt: 'asc' },
        take: BATCH_SIZE,
      });
      for (const job of jobs) await this.process(job.id, job.attempts, job.objectKey);
    } finally {
      this.running = false;
    }
  }

  private async process(id: string, attempts: number, objectKey: string): Promise<void> {
    const claimed = await this.prisma.storageCleanupJob.updateMany({
      where: { id, completedAt: null, attempts },
      data: { attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) return;

    try {
      await this.storage.delete(objectKey);
      await this.prisma.storageCleanupJob.update({
        where: { id },
        data: { completedAt: new Date(), lastError: null },
      });
    } catch (error) {
      await this.prisma.storageCleanupJob.update({
        where: { id },
        data: { lastError: error instanceof Error ? error.message : String(error) },
      });
    }
  }
}
