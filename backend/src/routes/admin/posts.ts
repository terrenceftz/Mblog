import { Hono } from 'hono';
import { eq, desc, count, and, inArray } from 'drizzle-orm';
import { posts, tags, postTags, categories, collections } from '../../db/schema';
import { createPost, updatePost, deletePost } from '../../services/posts';
import type { Db } from '../../db';

export function postsAdminRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/posts', (c) => {
    // 分页参数加固：非法/小数一律回落默认值，防止 NaN 泄漏到 LIMIT/OFFSET
    const rawPage = Number(c.req.query('page') ?? 1);
    const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
    const rawSize = Number(c.req.query('pageSize') ?? 20);
    const pageSize = Number.isInteger(rawSize) && rawSize >= 1 ? Math.min(100, rawSize) : 20;
    const status = c.req.query('status');
    const rawCat = Number(c.req.query('categoryId'));
    const categoryId = Number.isInteger(rawCat) && rawCat >= 1 ? rawCat : 0;

    const conditions = [];
    if (status === 'draft' || status === 'published') conditions.push(eq(posts.status, status));
    if (categoryId) conditions.push(eq(posts.categoryId, categoryId));

    const where = conditions.length ? and(...conditions) : undefined;
    const total = ctx.db.select({ n: count() }).from(posts).where(where).get()?.n ?? 0;
    const list = ctx.db.select().from(posts).where(where)
      .orderBy(desc(posts.updatedAt)).limit(pageSize).offset((page - 1) * pageSize).all();
    return c.json({ data: { list, total } });
  });

  app.get('/posts/:id', (c) => {
    const id = Number(c.req.param('id'));
    const post = ctx.db.select().from(posts).where(eq(posts.id, id)).get();
    if (!post) return c.json({ error: { code: 'NOT_FOUND', message: '文章不存在' } }, 404);
    const tagRows = ctx.db.select({ id: tags.id, name: tags.name, slug: tags.slug })
      .from(postTags).innerJoin(tags, eq(postTags.tagId, tags.id))
      .where(eq(postTags.postId, id)).all();
    return c.json({ data: { ...post, tags: tagRows } });
  });

  app.post('/posts', async (c) => {
    const body = await c.req.json().catch(() => null);
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    if (!title) return c.json({ error: { code: 'INVALID', message: '标题不能为空' } }, 400);
    const categoryId = typeof body.categoryId === 'number' ? body.categoryId : null;
    if (categoryId !== null) {
      const cat = ctx.db.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId)).get();
      if (!cat) return c.json({ error: { code: 'INVALID', message: '分类不存在' } }, 400);
    }
    const collectionId = typeof body.collectionId === 'number' ? body.collectionId : null;
    if (collectionId !== null) {
      const col = ctx.db.select({ id: collections.id }).from(collections).where(eq(collections.id, collectionId)).get();
      if (!col) return c.json({ error: { code: 'INVALID', message: '合集不存在' } }, 400);
    }
    const tagIds = Array.isArray(body.tagIds) ? body.tagIds : [];
    if (tagIds.length) {
      const tagCount = ctx.db.select({ n: count() }).from(tags).where(inArray(tags.id, tagIds)).get()?.n ?? 0;
      if (tagCount !== tagIds.length) return c.json({ error: { code: 'INVALID', message: '存在无效标签' } }, 400);
    }
    const slug = typeof body.slug === 'string' && body.slug.trim() ? body.slug.trim() : undefined;
    if (slug) {
      const dup = ctx.db.select({ id: posts.id }).from(posts).where(eq(posts.slug, slug)).get();
      if (dup) return c.json({ error: { code: 'CONFLICT', message: 'slug 已存在' } }, 409);
    }
    const id = await createPost(ctx, {
      title,
      slug,
      contentMd: typeof body.contentMd === 'string' ? body.contentMd : '',
      summary: typeof body.summary === 'string' ? body.summary : undefined,
      cover: typeof body.cover === 'string' ? body.cover : undefined,
      categoryId,
      collectionId,
      status: body.status === 'published' ? 'published' : 'draft',
      tagIds,
    });
    return c.json({ data: { id } }, 201);
  });

  app.put('/posts/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => null);
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    if (!title) return c.json({ error: { code: 'INVALID', message: '标题不能为空' } }, 400);
    const categoryId = typeof body.categoryId === 'number' ? body.categoryId : null;
    if (categoryId !== null) {
      const cat = ctx.db.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId)).get();
      if (!cat) return c.json({ error: { code: 'INVALID', message: '分类不存在' } }, 400);
    }
    const collectionId = typeof body.collectionId === 'number' ? body.collectionId : null;
    if (collectionId !== null) {
      const col = ctx.db.select({ id: collections.id }).from(collections).where(eq(collections.id, collectionId)).get();
      if (!col) return c.json({ error: { code: 'INVALID', message: '合集不存在' } }, 400);
    }
    const tagIds = Array.isArray(body.tagIds) ? body.tagIds : [];
    if (tagIds.length) {
      const tagCount = ctx.db.select({ n: count() }).from(tags).where(inArray(tags.id, tagIds)).get()?.n ?? 0;
      if (tagCount !== tagIds.length) return c.json({ error: { code: 'INVALID', message: '存在无效标签' } }, 400);
    }
    const slug = typeof body.slug === 'string' && body.slug.trim() ? body.slug.trim() : undefined;
    // 显式检查文章是否存在：不存在返回 404，其余未预期错误交给全局错误处理返回 500
    const exists = ctx.db.select({ id: posts.id }).from(posts).where(eq(posts.id, id)).get();
    if (!exists) return c.json({ error: { code: 'NOT_FOUND', message: '文章不存在' } }, 404);
    await updatePost(ctx, id, {
      title,
      slug,
      contentMd: typeof body.contentMd === 'string' ? body.contentMd : '',
      summary: typeof body.summary === 'string' ? body.summary : undefined,
      cover: typeof body.cover === 'string' ? body.cover : undefined,
      categoryId,
      collectionId,
      status: body.status === 'published' ? 'published' : 'draft',
      tagIds,
    });
    return c.json({ data: { id } });
  });

  app.delete('/posts/:id', (c) => {
    const id = Number(c.req.param('id'));
    deletePost(ctx, id);
    return c.json({ data: { ok: true } });
  });

  return app;
}
