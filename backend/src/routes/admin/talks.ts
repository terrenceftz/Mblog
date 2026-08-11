import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { talks } from '../../db/schema';
import type { Db } from '../../db';

export function talksAdminRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/talks', (c) => {
    const status = c.req.query('status');
    const rows = ctx.db
      .select()
      .from(talks)
      .where(status === 'pending' || status === 'approved' || status === 'rejected' ? eq(talks.status, status) : undefined)
      .orderBy(desc(talks.createdAt))
      .limit(200)
      .all();
    return c.json({ data: rows });
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
