import { Hono } from 'hono';
import { eq, count } from 'drizzle-orm';
import { collections, posts } from '../../db/schema';
import { makeSlug } from '../../lib/slug';
import type { Db } from '../../db';

// 合集/专栏管理（系列文章聚合）。样式与 categories 对齐。
export function collectionsAdminRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/collections', (c) => {
    const rows = ctx.db.select({
      id: collections.id,
      name: collections.name,
      slug: collections.slug,
      description: collections.description,
      sortOrder: collections.sortOrder,
      postCount: count(posts.id),
    }).from(collections)
      .leftJoin(posts, eq(posts.collectionId, collections.id))
      .groupBy(collections.id)
      .orderBy(collections.sortOrder)
      .all();
    return c.json({ data: rows });
  });

  app.post('/collections', async (c) => {
    const body = await c.req.json().catch(() => null);
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 50) : '';
    if (!name) return c.json({ error: { code: 'INVALID', message: '合集名不能为空' } }, 400);
    const slug = typeof body?.slug === 'string' && body.slug.trim() ? body.slug.trim() : makeSlug(name);
    const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 200) : '';
    const sortOrder = typeof body?.sortOrder === 'number' ? body.sortOrder : 0;
    const existing = ctx.db.select({ id: collections.id }).from(collections).where(eq(collections.slug, slug)).get();
    if (existing) return c.json({ error: { code: 'CONFLICT', message: 'slug 已存在' } }, 409);
    const row = ctx.db.insert(collections).values({ name, slug, description, sortOrder }).returning().get();
    return c.json({ data: row }, 201);
  });

  app.put('/collections/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => null);
    const row = ctx.db.select().from(collections).where(eq(collections.id, id)).get();
    if (!row) return c.json({ error: { code: 'NOT_FOUND', message: '合集不存在' } }, 404);
    const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 50) : row.name;
    const slug = typeof body?.slug === 'string' && body.slug.trim() ? body.slug.trim() : row.slug;
    const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 200) : row.description;
    const sortOrder = typeof body?.sortOrder === 'number' ? body.sortOrder : row.sortOrder;
    const dup = ctx.db.select({ id: collections.id }).from(collections).where(eq(collections.slug, slug)).get();
    if (dup && dup.id !== id) return c.json({ error: { code: 'CONFLICT', message: 'slug 已存在' } }, 409);
    ctx.db.update(collections).set({ name, slug, description, sortOrder }).where(eq(collections.id, id)).run();
    return c.json({ data: { id } });
  });

  app.delete('/collections/:id', (c) => {
    const id = Number(c.req.param('id'));
    // 先把该合集下的文章置空（posts.collection_id 无外键约束，手动清理）
    ctx.db.update(posts).set({ collectionId: null }).where(eq(posts.collectionId, id)).run();
    ctx.db.delete(collections).where(eq(collections.id, id)).run();
    return c.json({ data: { ok: true } });
  });

  return app;
}
