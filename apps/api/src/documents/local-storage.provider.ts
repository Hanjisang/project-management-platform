import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { StorageProvider, StoredObject } from './storage.provider';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly basePath: string;
  constructor(config: ConfigService) {
    this.basePath = resolve(config.get('STORAGE_PATH', './storage'));
  }
  async put(fileName: string, content: Buffer): Promise<StoredObject> {
    const now = new Date();
    const extension = extname(fileName)
      .toLowerCase()
      .replace(/[^.a-z0-9]/g, '')
      .slice(0, 12);
    const objectKey = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}${extension}`;
    const target = this.resolveKey(objectKey);
    await mkdir(resolve(target, '..'), { recursive: true });
    await writeFile(target, content, { flag: 'wx' });
    return {
      objectKey,
      size: BigInt(content.length),
      checksum: createHash('sha256').update(content).digest('hex'),
    };
  }
  get(objectKey: string): Promise<Buffer> {
    return readFile(this.resolveKey(objectKey));
  }
  async delete(objectKey: string): Promise<void> {
    try {
      await unlink(this.resolveKey(objectKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  async health(): Promise<{ configured: boolean; provider: string }> {
    await mkdir(this.basePath, { recursive: true });
    return { configured: true, provider: 'local' };
  }
  private resolveKey(objectKey: string): string {
    const target = resolve(this.basePath, objectKey);
    if (target !== this.basePath && !target.startsWith(`${this.basePath}${sep}`))
      throw new Error('invalid object key');
    return target;
  }
}
