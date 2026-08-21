import path from 'node:path';
import { randomUUID } from 'node:crypto';
import COS from 'cos-nodejs-sdk-v5';
import type { StorageProvider, StorageResult, UploadInput } from './index';

interface COSConfig {
  secretId: string;
  secretKey: string;
  bucket: string;
  region: string;
}

export class COSStorage implements StorageProvider {
  readonly type = 'cos' as const;
  private cos: COS;

  constructor(private config: COSConfig) {
    this.cos = new COS({ SecretId: config.secretId, SecretKey: config.secretKey });
  }

  private get baseUrl(): string {
    return `https://${this.config.bucket}.cos.${this.config.region}.myqcloud.com`;
  }

  async upload(input: UploadInput): Promise<StorageResult> {
    // 优先用服务端嗅探派生的扩展名；无则回退文件名扩展名（仅兜底，正常上传必有 ext）
    const ext = (input.ext ?? path.extname(input.filename)).toLowerCase().slice(0, 10);
    const key = `uploads/${Date.now()}-${randomUUID()}${ext}`;
    await this.cos.putObject({
      Bucket: this.config.bucket,
      Region: this.config.region,
      Key: key,
      Body: input.buffer,
    });
    return { url: `${this.baseUrl}/${key}`, key };
  }

  async delete(key: string): Promise<void> {
    await this.cos.deleteObject({
      Bucket: this.config.bucket,
      Region: this.config.region,
      Key: key,
    });
  }
}
