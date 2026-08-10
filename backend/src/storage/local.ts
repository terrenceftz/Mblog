import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import type { StorageProvider, StorageResult, UploadInput } from './index';

export class LocalStorage implements StorageProvider {
  readonly type = 'local' as const;

  private get uploadDir(): string {
    return process.env.UPLOAD_DIR ?? 'uploads';
  }

  async upload(input: UploadInput): Promise<StorageResult> {
    const ext = path.extname(input.filename).toLowerCase().slice(0, 10);
    const key = `${Date.now()}-${randomUUID()}${ext}`;
    const fullPath = path.join(this.uploadDir, key);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, input.buffer);
    return { url: `/uploads/${key}`, key };
  }

  async delete(key: string): Promise<void> {
    await rm(path.join(this.uploadDir, path.basename(key)), { force: true });
  }
}
