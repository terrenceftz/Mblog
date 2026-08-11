import { Hono } from 'hono';
import { eq, count } from 'drizzle-orm';
import { posts, comments, friendLinks } from '../../db/schema';
import type { Db } from '../../db';

// 前台首页数据统计：文章 / 评论 / 浏览 / 友链
export function statsRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/stats', (c) => {
    const postTotal = ctx.db.select({ n: count() }).from(posts).where(eq(posts.status, 'published')).get()?.n ?? 0;
    const commentTotal = ctx.db.select({ n: count() }).from(comments).where(eq(comments.status, 'approved')).get()?.n ?? 0;
    const totalViews = ctx.db.select({ n: posts.viewCount }).from(posts).all().reduce((s, r) => s + r.n, 0);
    const friendLinkCount = ctx.db.select({ n: count() }).from(friendLinks).where(eq(friendLinks.status, 'approved')).get()?.n ?? 0;
    return c.json({ data: { postTotal, commentTotal, totalViews, friendLinkCount } });
  });

  return app;
}
