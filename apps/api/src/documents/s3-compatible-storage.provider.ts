import { ServiceUnavailableException } from '@nestjs/common';
import type { StorageProvider } from './storage.provider';

export class S3CompatibleStorageProvider implements StorageProvider {
  private unavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 'S3_NOT_CONFIGURED',
      message: 'S3 Compatible 存储适配器已预留，当前未配置可用客户端',
    });
  }
  put(): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  get(): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  delete(): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  health(): Promise<{ configured: boolean; provider: string }> {
    return Promise.resolve({ configured: false, provider: 's3' });
  }
}
