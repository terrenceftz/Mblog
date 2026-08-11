import { Hono } from 'hono';
import { eq, desc, count } from 'drizzle-orm';
import { talks } from '../../db/schema';
import type { Db } from '../../db';

export function talksAdminRoutes(ctx: Db) {
  const app = new Hono();

  // 作者发布说说：免审核，直接 approved（发布者为作者）
  app.post('/talks', async (c) => {
    const body = await c.req.json().catch(() => null);
    const content = typeof body?.content === 'string' ? body.content.trim().slice(0, 500) : '';
    if (!content) return c.json({ error: { code: 'INVALID', message: '内容不能为空' } }, 400);
    ctx.db.insert(talks).values({ content, ip: 'admin', status: 'approved' }).run();
    return c.json({ data: { message: '已发布' } }, 201);
  });

  app.get('/talks', (c) => {
    const status = c.req.query('status');
    const where = status === 'pending' || status === 'approved' || status === 'rejected' ? eq(talks.status, status) : undefined;
    const total = ctx.db.select({ n: count() }).from(talks).where(where).get()?.n ?? 0;
    const rawPage = Number(c.req.query('page') ?? 1);
    const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
    const rawSize = Number(c.req.query('pageSize') ?? 20);
    const pageSize = Number.isInteger(rawSize) && rawSize >= 1 ? Math.min(100, rawSize) : 20;
    const rows = ctx.db
      .select()
      .from(talks)
      .where(where)
      .orderBy(desc(talks.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .all();
    return c.json({ data: { list: rows, total } });
  });

  app.delete('/talks/:id', (c) => {
    const id = Number(c.req.param('id'));
    ctx.db.delete(talks).where(eq(talks.id, id)).run();
    return c.json({ data: { ok: true } });
  });

  app.patch('/talks/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => null);
    const status = body?.status;
    if (status !== 'approved' && status !== 'rejected' && status !== 'pending') {
      return c.json({ error: { code: 'INVALID', message: '无效状态' } }, 400);
    }
    const row = ctx.db.select().from(talks).where(eq(talks.id, id)).get();
    if (!row) return c.json({ error: { code: 'NOT_FOUND', message: '说说不存在' } }, 404);
    ctx.db.update(talks).set({ status }).where(eq(talks.id, id)).run();
    return c.json({ data: { id, status } });
  });

  return app;
}
