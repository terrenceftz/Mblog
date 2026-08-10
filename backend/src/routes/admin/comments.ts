import { Hono } from 'hono';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { comments } from '../../db/schema';
import type { Db } from '../../db';

export function commentsAdminRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/comments', (c) => {
    const status = c.req.query('status');
    const conditions = [];
    if (status === 'pending' || status === 'approved' || status === 'rejected') {
      conditions.push(eq(comments.status, status));
    }
    const where = and(...conditions);
    const rows = ctx.db.select().from(comments).where(where).orderBy(desc(comments.createdAt)).all();
    return c.json({ data: rows });
  });

  app.patch('/comments/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => null);
    const status = body?.status;
    if (status !== 'approved' && status !== 'rejected' && status !== 'pending') {
      return c.json({ error: { code: 'INVALID', message: '无效状态' } }, 400);
    }
    const row = ctx.db.select().from(comments).where(eq(comments.id, id)).get();
    if (!row) return c.json({ error: { code: 'NOT_FOUND', message: '评论不存在' } }, 404);
    ctx.db.update(comments).set({ status }).where(eq(comments.id, id)).run();
    return c.json({ data: { id, status } });
  });

  app.post('/comments/:id/reply', async (c) => {
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => null);
    const content = typeof body?.content === 'string' ? body.content.trim().slice(0, 2000) : '';
    if (!content) return c.json({ error: { code: 'INVALID', message: '回复内容不能为空' } }, 400);
    const parent = ctx.db.select().from(comments).where(eq(comments.id, id)).get();
    if (!parent) return c.json({ error: { code: 'NOT_FOUND', message: '评论不存在' } }, 404);
    ctx.db.insert(comments).values({
      postId: parent.postId, author: '博主', content, status: 'approved', parentId: id,
    }).run();
    return c.json({ data: { ok: true } }, 201);
  });

  app.post('/comments/batch', async (c) => {
    const body = await c.req.json().catch(() => null);
    const ids = Array.isArray(body?.ids) ? body.ids.map(Number) : [];
    const action = body?.action;
    if (ids.length === 0) return c.json({ error: { code: 'INVALID', message: '缺少 ids' } }, 400);
    if (action === 'delete') {
      ctx.db.delete(comments).where(inArray(comments.id, ids)).run();
    } else if (action === 'approve' || action === 'reject') {
      ctx.db.update(comments).set({ status: action }).where(inArray(comments.id, ids)).run();
    } else {
      return c.json({ error: { code: 'INVALID', message: '无效操作' } }, 400);
    }
    return c.json({ data: { ok: true } });
  });

  app.delete('/comments/:id', (c) => {
    const id = Number(c.req.param('id'));
    ctx.db.delete(comments).where(eq(comments.id, id)).run();
    return c.json({ data: { ok: true } });
  });

  return app;
}
