import { Hono } from 'hono';
import { eq, asc } from 'drizzle-orm';
import { friendLinks } from '../../db/schema';
import { rateLimit } from '../../middleware/rateLimit';
import { getSetting } from '../../lib/settings';
import type { Db } from '../../db';

export function friendLinksRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/friend-links', (c) => {
    // 只暴露已审核友链；不返回 status 等内部字段
    const rows = ctx.db
      .select({
        id: friendLinks.id,
        name: friendLinks.name,
        url: friendLinks.url,
        description: friendLinks.description,
        avatar: friendLinks.avatar,
      })
      .from(friendLinks)
      .where(eq(friendLinks.status, 'approved'))
      .orderBy(asc(friendLinks.createdAt))
      .all();
    return c.json({ data: rows });
  });

  app.post('/friend-links', rateLimit(5, 60_000), async (c) => {
    if (getSetting(ctx, 'friend_link_enabled') !== '1') {
      return c.json({ error: { code: 'FORBIDDEN', message: '友链申请已关闭' } }, 403);
    }
    const body = await c.req.json().catch(() => null);
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 50) : '';
    const rawUrl = typeof body?.url === 'string' ? body.url.trim().slice(0, 300) : '';
    const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 200) : '';
    // URL 解析校验：仅 http/https，且拒绝引号/空白等属性注入向量
    let url: URL | null = null;
    if (name && rawUrl && !/[\s"'<>]/.test(rawUrl)) {
      try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') url = parsed;
      } catch {
        url = null;
      }
    }
    if (!url) {
      return c.json({ error: { code: 'INVALID', message: '请填写站名和有效网址' } }, 400);
    }
    ctx.db.insert(friendLinks).values({ name, url: url.href, description, status: 'pending' }).run();
    return c.json({ data: { message: '申请已提交，等待审核' } }, 201);
  });

  return app;
}
