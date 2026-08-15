import { Hono } from 'hono';
import { eq, desc, count } from 'drizzle-orm';
import { categories, posts } from '../../db/schema';
import { makeSlug } from '../../lib/slug';
import type { Db } from '../../db';

export function categoriesAdminRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/categories', (c) => {
    // 后台统计全部文章（含草稿）
    const rows = ctx.db.select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      sortOrder: categories.sortOrder,
      cover: categories.cover,
      postCount: count(posts.id),
    }).from(categories)
      .leftJoin(posts, eq(posts.categoryId, categories.id))
      .groupBy(categories.id)
      .orderBy(desc(categories.sortOrder))
      .all();
    return c.json({ data: rows });
  });

  app.post('/categories', async (c) => {
    const body = await c.req.json().catch(() => null);
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 50) : '';
    if (!name) return c.json({ error: { code: 'INVALID', message: '分类名不能为空' } }, 400);
    const slug = typeof body?.slug === 'string' && body.slug.trim() ? body.slug.trim() : makeSlug(name);
    const sortOrder = typeof body?.sortOrder === 'number' ? body.sortOrder : 0;
    const cover = typeof body?.cover === 'string' ? body.cover.trim().slice(0, 500) : '';
    const existing = ctx.db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)).get();
    if (existing) return c.json({ error: { code: 'CONFLICT', message: 'slug 已存在' } }, 409);
    const row = ctx.db.insert(categories).values({ name, slug, sortOrder, cover }).returning().get();
    return c.json({ data: row }, 201);
  });

  app.put('/categories/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => null);
    const row = ctx.db.select().from(categories).where(eq(categories.id, id)).get();
    if (!row) return c.json({ error: { code: 'NOT_FOUND', message: '分类不存在' } }, 404);
    const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 50) : row.name;
    const slug = typeof body?.slug === 'string' && body.slug.trim() ? body.slug.trim() : row.slug;
    const sortOrder = typeof body?.sortOrder === 'number' ? body.sortOrder : row.sortOrder;
    // cover 显式传 null 视为清空；不传保留原值
    const cover = typeof body?.cover === 'string' ? body.cover.trim().slice(0, 500) : row.cover;
    const dup = ctx.db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)).get();
    if (dup && dup.id !== id) return c.json({ error: { code: 'CONFLICT', message: 'slug 已存在' } }, 409);
    ctx.db.update(categories).set({ name, slug, sortOrder, cover }).where(eq(categories.id, id)).run();
    return c.json({ data: { id } });
  });

  app.delete('/categories/:id', (c) => {
    const id = Number(c.req.param('id'));
    // 删除分类时文章自动置为未分类（schema 的 onDelete: set null）
    ctx.db.delete(categories).where(eq(categories.id, id)).run();
    return c.json({ data: { ok: true } });
  });

  return app;
}
