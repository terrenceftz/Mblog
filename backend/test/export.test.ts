import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { makeTestApp, loginAsAdmin, authHeaders } from './helpers';
import { posts } from '../src/db/schema';
import { runBackup } from '../src/lib/backup';

describe('export', () => {
  const { app, ctx } = makeTestApp();
  let token = '';

  beforeAll(async () => {
    token = await loginAsAdmin(app);
    ctx.db.insert(posts).values({
      title: '导出: 测试文章', slug: 'export-post', status: 'published',
      contentMd: '# 你好\n正文', contentHtml: '<h1>你好</h1>',
    }).run();
  });

  it('GET /admin/export 返回 zip（PK 头 + 包含 md 条目）', async () => {
    const r = await app.request('/api/admin/export', { headers: authHeaders(token) });
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('application/zip');
    const buf = Buffer.from(await r.arrayBuffer());
    expect(buf.slice(0, 2).toString('ascii')).toBe('PK');
    // 本地存储时 uploads/ 也应打进包（本地 dev 有上传文件；仅断言 posts/*.md 与 manifest 存在）
    const names = buf.toString('latin1').match(/posts\/[a-z0-9-]+\.md/g) ?? [];
    expect(names.length).toBeGreaterThan(0);
    expect(buf.toString('latin1')).toContain('manifest.json');
  });
});

describe('backup retention', () => {
  const { app, ctx } = makeTestApp();
  let dir = '';

  it('超出 BACKUP_KEEP 份时删除最旧的备份', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'mblog-keep-'));
    process.env.BACKUP_DIR = dir;
    process.env.BACKUP_KEEP = '2';
    try {
      await runBackup(ctx);
      // 手工塞一个"更旧"的备份名（ISO 字典序更小）
      const { writeFileSync } = await import('node:fs');
      writeFileSync(path.join(dir, 'mblog-2020-01-01T00-00-00-000Z.db'), 'old');
      await runBackup(ctx);
      await runBackup(ctx);
      const files = readdirSync(dir).filter((f) => f.endsWith('.db')).sort();
      expect(files).toHaveLength(2);
      expect(files[0]).not.toContain('2020-01-01'); // 最旧的已被清理
    } finally {
      delete process.env.BACKUP_DIR;
      delete process.env.BACKUP_KEEP;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('rss full text', () => {
  const { app, ctx } = makeTestApp();

  it('content:encoded 含渲染后 HTML，channel 含 lastBuildDate 与 atom:link', async () => {
    ctx.db.insert(posts).values({
      title: 'RSS 全文', slug: 'rss-full', status: 'published',
      contentMd: '# 标题\n\n正文段落', contentHtml: '',
    }).run();
    const r = await app.request('/api/rss');
    expect(r.status).toBe(200);
    const xml = await r.text();
    expect(xml).toContain('<content:encoded>');
    expect(xml).toContain('<h1');
    expect(xml).toContain('<lastBuildDate>');
    expect(xml).toContain('atom:link');
    expect(r.headers.get('cache-control')).toContain('max-age=600');
  });
});
