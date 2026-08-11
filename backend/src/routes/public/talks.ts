import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { talks } from '../../db/schema';
import { rateLimit } from '../../middleware/rateLimit';
import type { Db } from '../../db';

export function talksRoutes(ctx: Db) {
  const app = new Hono();

  // 公开列表：只返回已审核的说说
  app.get('/talks', (c) => {
    const rows = ctx.db
      .select({ id: talks.id, content: talks.content, createdAt: talks.createdAt })
      .from(talks)
      .where(eq(talks.status, 'approved'))
      .orderBy(desc(talks.createdAt))
      .limit(100)
      .all();
    return c.json({ data: rows });
  });

  // 发布说说：进审核队列
  app.post('/talks', rateLimit(5, 60_000), async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.content !== 'string') {
      return c.json({ error: { code: 'INVALID', message: '参数错误' } }, 400);
    }
    const content = body.content.trim().slice(0, 500);
    if (!content) return c.json({ error: { code: 'INVALID', message: '内容不能为空' } }, 400);
    // 蜜罐
    if (typeof body._hp === 'string' && body._hp.trim() !== '') {
      return c.json({ error: { code: 'INVALID', message: '参数错误' } }, 400);
    }
    const ip =
      c.req.header('x-real-ip')?.trim() ||
      c.req.header('x-forwarded-for')?.split(',').pop()?.trim() ||
      'unknown';
    ctx.db.insert(talks).values({ content, ip, status: 'pending' }).run();
    return c.json({ data: { message: '已提交，等待审核' } }, 201);
  });

  return app;
}
