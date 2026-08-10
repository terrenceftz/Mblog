import { Hono } from 'hono';
import { eq, desc, and } from 'drizzle-orm';
import { friendLinks } from '../../db/schema';
import type { Db } from '../../db';

export function friendLinksAdminRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/friend-links', (c) => {
    const status = c.req.query('status');
    const conditions = [];
    if (status === 'pending' || status === 'approved' || status === 'rejected') {
      conditions.push(eq(friendLinks.status, status));
    }
    const rows = ctx.db.select().from(friendLinks).where(and(...conditions)).orderBy(desc(friendLinks.createdAt)).all();
    return c.json({ data: rows });
  });

  app.post('/friend-links', async (c) => {
    const body = await c.req.json().catch(() => null);
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 50) : '';
    const url = typeof body?.url === 'string' ? body.url.trim().slice(0, 300) : '';
    if (!name || !url) return c.json({ error: { code: 'INVALID', message: '站名和网址必填' } }, 400);
    const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 200) : '';
    const avatar = typeof body?.avatar === 'string' ? body.avatar.trim().slice(0, 500) : '';
    const status = body?.status === 'approved' ? 'approved' : 'pending';
    const row = ctx.db.insert(friendLinks).values({ name, url, description, avatar, status }).returning().get();
    return c.json({ data: row }, 201);
  });

  app.put('/friend-links/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => null);
    const row = ctx.db.select().from(friendLinks).where(eq(friendLinks.id, id)).get();
    if (!row) return c.json({ error: { code: 'NOT_FOUND', message: '友链不存在' } }, 404);
    ctx.db.update(friendLinks).set({
      name: typeof body?.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 50) : row.name,
      url: typeof body?.url === 'string' && body.url.trim() ? body.url.trim().slice(0, 300) : row.url,
      description: typeof body?.description === 'string' ? body.description.trim().slice(0, 200) : row.description,
      avatar: typeof body?.avatar === 'string' ? body.avatar.trim().slice(0, 500) : row.avatar,
      status: body?.status === 'pending' || body?.status === 'approved' || body?.status === 'rejected'
        ? body.status : row.status,
    }).where(eq(friendLinks.id, id)).run();
    return c.json({ data: { id } });
  });

  app.delete('/friend-links/:id', (c) => {
    const id = Number(c.req.param('id'));
    ctx.db.delete(friendLinks).where(eq(friendLinks.id, id)).run();
    return c.json({ data: { ok: true } });
  });

  return app;
}
