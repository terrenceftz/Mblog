import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { makeTestApp, loginAsAdmin, authHeaders } from './helpers';
import { adminLogs } from '../src/db/schema';

describe('admin audit log', () => {
  const { app, ctx } = makeTestApp();

  it('写操作被记录，GET 列表不记录', async () => {
    const token = await loginAsAdmin(app);
    await app.request('/api/admin/posts', { headers: authHeaders(token) });
    const res = await app.request('/api/admin/categories', {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({ name: '技术' }),
    });
    expect(res.status).toBe(201);
    const rows = ctx.db.select().from(adminLogs).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].method).toBe('POST');
    expect(rows[0].path).toBe('/api/admin/categories');
    expect(rows[0].username).toBe('admin');
  });
});

describe('admin audit-logs api', () => {
  const { app } = makeTestApp();
  let token = '';

  it('GET /api/admin/audit-logs 返回分页日志，支持过滤', async () => {
    token = await loginAsAdmin(app);
    await app.request('/api/admin/tags', {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'js' }),
    });
    await app.request('/api/admin/tags', {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'css' }),
    });
    const res = await app.request('/api/admin/audit-logs?pageSize=1', { headers: authHeaders(token) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.total).toBe(2);
    expect(body.data.list).toHaveLength(1);
    expect(body.data.list[0].path).toBe('/api/admin/tags');

    const filtered = await app.request('/api/admin/audit-logs?method=DELETE', { headers: authHeaders(token) });
    const fb = await filtered.json();
    expect(fb.data.total).toBe(0);
  });
});

describe('admin backup', () => {
  const { app } = makeTestApp();
  let dir = '';

  it('POST /api/admin/backup 生成在线备份文件', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'mblog-backup-'));
    process.env.BACKUP_DIR = dir;
    const token = await loginAsAdmin(app);
    const res = await app.request('/api/admin/backup', { method: 'POST', headers: authHeaders(token) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.file).toMatch(/^mblog-.*\.db$/);
    expect(body.data.size).toBeGreaterThan(0);
    expect(existsSync(path.join(dir, body.data.file))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
    delete process.env.BACKUP_DIR;
  });
});
