import { Hono } from 'hono';
import { eq, count, sql } from 'drizzle-orm';
import { posts, comments, friendLinks, dailyStats, visitLog } from '../../db/schema';
import { rateLimit } from '../../middleware/rateLimit';
import { clientIp } from '../../lib/clientIp';
import type { Db } from '../../db';

// 服务器本地时区的 YYYY-MM-DD（统计按天聚合）
function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

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

  // 访问统计信标：前台页面加载后由浏览器 POST（sendBeacon），不阻塞渲染。
  // PV 计 daily_stats.views；UV 以 (day, ip) 主键去重计 visit_log 行数。真实 IP 依赖 nginx x-real-ip（TRUST_PROXY=1）。
  app.post('/track', rateLimit(120, 60_000), async (c) => {
    await c.req.json().catch(() => null); // 信标带 JSON body，读掉即可（暂不区分路径）
    const ip = clientIp(c) ?? 'unknown';
    const day = today();
    ctx.sqlite.transaction(() => {
      ctx.sqlite
        .prepare('INSERT INTO daily_stats (day, views) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET views = views + 1')
        .run(day);
      ctx.sqlite.prepare('INSERT OR IGNORE INTO visit_log (day, ip) VALUES (?, ?)').run(day, ip);
    })();
    return c.json({ data: { ok: true } }, 201);
  });

  return app;
}
