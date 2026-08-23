export interface StoredObject {
  objectKey: string;
  size: bigint;
  checksum: string;
}
export interface StorageProvider {
  put(fileName: string, content: Buffer): Promise<StoredObject>;
  get(objectKey: string): Promise<Buffer>;
  delete(objectKey: string): Promise<void>;
  health(): Promise<{ configured: boolean; provider: string }>;
}
export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
