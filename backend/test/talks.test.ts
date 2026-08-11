import { describe, it, expect } from 'vitest';
import { makeTestApp, loginAsAdmin, authHeaders } from './helpers';
import { talks } from '../src/db/schema';
import { eq } from 'drizzle-orm';

describe('admin talks', () => {
  const { app, ctx } = makeTestApp();

  it('作者发布说说：免审核直接 approved 并出现在前台', async () => {
    const token = await loginAsAdmin(app);
    const headers = authHeaders(token);
    const res = await app.request('/api/admin/talks', {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ content: '作者的第一条说说' }),
    });
    expect(res.status).toBe(201);
    const row = ctx.db.select().from(talks).get();
    expect(row?.status).toBe('approved');
    // 前台列表直接可见
    const list = await app.request('/api/talks');
    const body = (await list.json()) as { data: { content: string }[] };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].content).toBe('作者的第一条说说');
  });

  it('内容为空返回 400', async () => {
    const token = await loginAsAdmin(app);
    const headers = authHeaders(token);
    const res = await app.request('/api/admin/talks', {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ content: '  ' }),
    });
    expect(res.status).toBe(400);
  });

  it('后台审核说说（状态流转）', async () => {
    const token = await loginAsAdmin(app);
    const headers = authHeaders(token);
    ctx.db.insert(talks).values({ content: '待审说说', ip: '1.1.1.1', status: 'pending' }).run();
    const row = ctx.db.select().from(talks).get()!;
    const res = await app.request(`/api/admin/talks/${row.id}`, {
      method: 'PATCH',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'rejected' }),
    });
    expect(res.status).toBe(200);
    expect(ctx.db.select().from(talks).where(eq(talks.id, row.id)).get()?.status).toBe('rejected');
  });
});
