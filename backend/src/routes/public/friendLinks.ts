import { Hono } from 'hono';
import { eq, asc } from 'drizzle-orm';
import { friendLinks } from '../../db/schema';
import { rateLimit } from '../../middleware/rateLimit';
import { getSetting } from '../../lib/settings';
import type { Db } from '../../db';

export function friendLinksRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/friend-links', (c) => {
    // 只暴露已审核友链；不返回 status 等内部字段（rss 一并返回，备 RSS 聚合）
    const rows = ctx.db
      .select({
        id: friendLinks.id,
        name: friendLinks.name,
        url: friendLinks.url,
        description: friendLinks.description,
        avatar: friendLinks.avatar,
        rss: friendLinks.rss,
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
    const rawAvatar = typeof body?.avatar === 'string' ? body.avatar.trim().slice(0, 300) : '';
    const rawRss = typeof body?.rss === 'string' ? body.rss.trim().slice(0, 300) : '';
    // URL 解析校验：仅 http/https，且拒绝引号/空白等属性注入向量
    const parseUrl = (raw: string): URL | null => {
      if (!raw || /[\s"'<>]/.test(raw)) return null;
      try {
        const parsed = new URL(raw);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed : null;
      } catch {
        return null;
      }
    };
    const url = name ? parseUrl(rawUrl) : null;
    if (!url) {
      return c.json({ error: { code: 'INVALID', message: '请填写站名和有效网址' } }, 400);
    }
    // 头像/RSS 可选；填写时必须是合法 http(s) URL（前台会直接进 <img src>，rss 备聚合拉取）
    const avatar = parseUrl(rawAvatar);
    if (rawAvatar && !avatar) {
      return c.json({ error: { code: 'INVALID', message: '头像链接必须是有效的 http/https 网址' } }, 400);
    }
    const rss = parseUrl(rawRss);
    if (rawRss && !rss) {
      return c.json({ error: { code: 'INVALID', message: 'RSS 地址必须是有效的 http/https 网址' } }, 400);
    }
    ctx.db.insert(friendLinks).values({ name, url: url.href, description, avatar: avatar?.href ?? '', rss: rss?.href ?? '', status: 'pending' }).run();
    return c.json({ data: { message: '申请已提交，等待审核' } }, 201);
  });

  return app;
}
