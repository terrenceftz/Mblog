import { describe, it, expect } from 'vitest';
import { mkdtemp, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LocalStorage } from '../src/storage/local';

describe('LocalStorage', () => {
  it('上传写入文件并返回 URL，删除后文件消失', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'mblog-test-'));
    process.env.UPLOAD_DIR = dir;
    const storage = new LocalStorage();
    const result = await storage.upload({ filename: 'a.png', mime: 'image/png', buffer: Buffer.from('x') });
    expect(result.url).toMatch(/^\/uploads\//);
    const st = await stat(path.join(dir, result.key));
    expect(st.size).toBe(1);
    await storage.delete(result.key);
    await expect(stat(path.join(dir, result.key))).rejects.toThrow();
    await rm(dir, { recursive: true, force: true });
  });
});
