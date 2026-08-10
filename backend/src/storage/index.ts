import { getSetting } from '../lib/settings';
import { LocalStorage } from './local';
import { COSStorage } from './cos';
import type { Db } from '../db';

export interface UploadInput {
  filename: string;
  mime: string;
  buffer: Buffer;
}

export interface StorageResult {
  url: string;
  key: string;
}

export interface StorageProvider {
  readonly type: 'local' | 'cos';
  upload(input: UploadInput): Promise<StorageResult>;
  delete(key: string): Promise<void>;
}

/** 依据后台设置选择存储实现。 */
export function getStorage(ctx: Db): StorageProvider {
  const provider = getSetting(ctx, 'storage_provider');
  if (provider === 'cos') {
    return new COSStorage({
      secretId: getSetting(ctx, 'cos_secret_id'),
      secretKey: getSetting(ctx, 'cos_secret_key'),
      bucket: getSetting(ctx, 'cos_bucket'),
      region: getSetting(ctx, 'cos_region'),
    });
  }
  return new LocalStorage();
}
