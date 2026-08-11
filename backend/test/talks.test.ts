import { describe, it, expect } from 'vitest';
import { makeTestApp, loginAsAdmin, authHeaders } from './helpers';
import { talks } from '../src/db/schema';
import { eq } from 'drizzle-orm';

describe('public talks', () => {
  const { app, ctx } = makeTestApp();

  it('发布说说进入待审核，列表只返回已审核', async () => {
    const res = await app.request('/api/talks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '第一条说说' }),
    });
    expect(res.status).toBe(201);
    const empty = await app.request('/api/talks');
    expect(((await empty.json()) as { data: unknown[] }).data).toHaveLength(0);

    const row = ctx.db.select().from(talks).get();
    expect(row?.status).toBe('pending');
    ctx.db.update(talks).set({ status: 'approved' }).where(eq(talks.id, row!.id)).run();
    const list = await app.request('/api/talks');
    const body = (await list.json()) as { data: { content: string }[] };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].content).toBe('第一条说说');
  });

  it('内容为空返回 400', async () => {
    const res = await app.request('/api/talks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '  ' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('admin talks', () => {
  const { app, ctx } = makeTestApp();

  it('后台审核说说', async () => {
    const token = await loginAsAdmin(app);
    const headers = authHeaders(token);
    ctx.db.insert(talks).values({ content: '待审说说', ip: '1.1.1.1', status: 'pending' }).run();
    const row = ctx.db.select().from(talks).get()!;
    const res = await app.request(`/api/admin/talks/${row.id}`, {
      method: 'PATCH',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    expect(res.status).toBe(200);
    expect(ctx.db.select().from(talks).where(eq(talks.id, row.id)).get()?.status).toBe('approved');
    // 公开列表现在能看到了
    const list = await app.request('/api/talks');
    expect(((await list.json()) as { data: unknown[] }).data).toHaveLength(1);
  });
});
