import { Hono } from 'hono';
import { eq, desc, count } from 'drizzle-orm';
import { categories, tags, posts, postTags } from '../../db/schema';
import type { Db } from '../../db';

export function categoriesTagsRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/categories', (c) => {
    const rows = ctx.db.select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      postCount: count(posts.id),
    }).from(categories)
      .leftJoin(posts, eq(posts.categoryId, categories.id))
      .groupBy(categories.id)
      .orderBy(desc(categories.sortOrder))
      .all();
    return c.json({ data: rows });
  });

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

  return app;
}
