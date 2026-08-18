import { Hono } from 'hono';
import { eq, desc, count, and } from 'drizzle-orm';
import { adminLogs } from '../../db/schema';
import type { Db } from '../../db';

export function auditLogsAdminRoutes(ctx: Db) {
  const app = new Hono();

  // 操作日志列表（分页 + 按 username/method 过滤，时间倒序）
  app.get('/audit-logs', (c) => {
    const conditions = [];
    const username = c.req.query('username');
    if (username) conditions.push(eq(adminLogs.username, username));
    const method = c.req.query('method');
    if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
      conditions.push(eq(adminLogs.method, method));
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const total = ctx.db.select({ n: count() }).from(adminLogs).where(where).get()?.n ?? 0;
    const rawPage = Number(c.req.query('page') ?? 1);
    const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
    const rawSize = Number(c.req.query('pageSize') ?? 20);
    const pageSize = Number.isInteger(rawSize) && rawSize >= 1 ? Math.min(100, rawSize) : 20;
    const list = ctx.db
      .select()
      .from(adminLogs)
      .where(where)
      .orderBy(desc(adminLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .all();
    return c.json({ data: { list, total } });
  });

  return app;
}
