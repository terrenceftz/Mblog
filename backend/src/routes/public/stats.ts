import { Hono } from 'hono';
import { eq, count, sql } from 'drizzle-orm';
import { posts, comments, friendLinks } from '../../db/schema';
import type { Db } from '../../db';

// 前台首页数据统计：文章 / 评论 / 浏览 / 友链
export function statsRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/stats', (c) => {
    const postTotal = ctx.db.select({ n: count() }).from(posts).where(eq(posts.status, 'published')).get()?.n ?? 0;
    const commentTotal = ctx.db.select({ n: count() }).from(comments).where(eq(comments.status, 'approved')).get()?.n ?? 0;
    // 浏览总量走 SQL SUM（此前全表取回 JS 累加，文章多了会拖慢首页）
    const totalViews = ctx.db
      .select({ n: sql<number>`coalesce(sum(${posts.viewCount}), 0)` })
      .from(posts)
      .get()?.n ?? 0;
    const friendLinkCount = ctx.db.select({ n: count() }).from(friendLinks).where(eq(friendLinks.status, 'approved')).get()?.n ?? 0;
    return c.json({ data: { postTotal, commentTotal, totalViews, friendLinkCount } });
  });

  return app;
}
