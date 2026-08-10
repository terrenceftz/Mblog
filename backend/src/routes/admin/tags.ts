import { Hono } from 'hono';
import { eq, count } from 'drizzle-orm';
import { tags, postTags } from '../../db/schema';
import { makeSlug } from '../../lib/slug';
import type { Db } from '../../db';

export function tagsAdminRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/tags', (c) => {
    const rows = ctx.db.select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      postCount: count(postTags.postId),
    }).from(tags)
      .leftJoin(postTags, eq(postTags.tagId, tags.id))
      .groupBy(tags.id)
      .all();
    return c.json({ data: rows });
  });

  app.post('/tags', async (c) => {
    const body = await c.req.json().catch(() => null);
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 50) : '';
    if (!name) return c.json({ error: { code: 'INVALID', message: '标签名不能为空' } }, 400);
    const slug = typeof body?.slug === 'string' && body.slug.trim() ? body.slug.trim() : makeSlug(name);
    const existing = ctx.db.select({ id: tags.id }).from(tags).where(eq(tags.slug, slug)).get();
    if (existing) return c.json({ error: { code: 'CONFLICT', message: 'slug 已存在' } }, 409);
    const row = ctx.db.insert(tags).values({ name, slug }).returning().get();
    return c.json({ data: row }, 201);
  });

  app.put('/tags/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => null);
    const row = ctx.db.select().from(tags).where(eq(tags.id, id)).get();
    if (!row) return c.json({ error: { code: 'NOT_FOUND', message: '标签不存在' } }, 404);
    const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 50) : row.name;
    const slug = typeof body?.slug === 'string' && body.slug.trim() ? body.slug.trim() : row.slug;
    const dup = ctx.db.select({ id: tags.id }).from(tags).where(eq(tags.slug, slug)).get();
    if (dup && dup.id !== id) return c.json({ error: { code: 'CONFLICT', message: 'slug 已存在' } }, 409);
    ctx.db.update(tags).set({ name, slug }).where(eq(tags.id, id)).run();
    return c.json({ data: { id } });
  });

  app.delete('/tags/:id', (c) => {
    const id = Number(c.req.param('id'));
    // 删除标签时 post_tags 关联级联删除（schema onDelete: cascade）
    ctx.db.delete(tags).where(eq(tags.id, id)).run();
    return c.json({ data: { ok: true } });
  });

  return app;
}
