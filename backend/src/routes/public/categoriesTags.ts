import { Hono } from 'hono';
import { eq, desc, count, and } from 'drizzle-orm';
import { categories, tags, posts, postTags } from '../../db/schema';
import type { Db } from '../../db';

export function categoriesTagsRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/categories', (c) => {
    // postCount 只统计已发布文章
    const rows = ctx.db.select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      postCount: count(posts.id),
    }).from(categories)
      .leftJoin(posts, and(eq(posts.categoryId, categories.id), eq(posts.status, 'published')))
      .groupBy(categories.id)
      .orderBy(desc(categories.sortOrder))
      .all();
    return c.json({ data: rows });
  });

  app.get('/tags', (c) => {
    // postCount 只统计关联了已发布文章
    const rows = ctx.db.select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      postCount: count(posts.id),
    }).from(tags)
      .leftJoin(postTags, eq(postTags.tagId, tags.id))
      .leftJoin(posts, and(eq(posts.id, postTags.postId), eq(posts.status, 'published')))
      .groupBy(tags.id)
      .all();
    return c.json({ data: rows });
  });

  return app;
}
