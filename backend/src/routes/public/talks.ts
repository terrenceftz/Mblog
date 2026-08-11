import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { talks } from '../../db/schema';
import type { Db } from '../../db';

export function talksRoutes(ctx: Db) {
  const app = new Hono();

  // 说说列表（仅展示；发布者为作者，由后台直接发布）
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

  return app;
}
