import { Hono } from 'hono';
import { eq, desc, count, and } from 'drizzle-orm';
import { posts, tags, postTags } from '../../db/schema';
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
    const id = await createPost(ctx, {
      title,
      slug: typeof body.slug === 'string' ? body.slug : undefined,
      contentMd: typeof body.contentMd === 'string' ? body.contentMd : '',
      summary: typeof body.summary === 'string' ? body.summary : undefined,
      cover: typeof body.cover === 'string' ? body.cover : undefined,
      categoryId: typeof body.categoryId === 'number' ? body.categoryId : null,
      status: body.status === 'published' ? 'published' : 'draft',
      tagIds: Array.isArray(body.tagIds) ? body.tagIds : [],
    });
    return c.json({ data: { id } }, 201);
  });

  app.put('/posts/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => null);
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    if (!title) return c.json({ error: { code: 'INVALID', message: '标题不能为空' } }, 400);
    try {
      await updatePost(ctx, id, {
        title,
        slug: typeof body.slug === 'string' ? body.slug : undefined,
        contentMd: typeof body.contentMd === 'string' ? body.contentMd : '',
        summary: typeof body.summary === 'string' ? body.summary : undefined,
        cover: typeof body.cover === 'string' ? body.cover : undefined,
        categoryId: typeof body.categoryId === 'number' ? body.categoryId : null,
        status: body.status === 'published' ? 'published' : 'draft',
        tagIds: Array.isArray(body.tagIds) ? body.tagIds : [],
      });
    } catch {
      return c.json({ error: { code: 'NOT_FOUND', message: '文章不存在' } }, 404);
    }
    return c.json({ data: { id } });
  });

  app.delete('/posts/:id', (c) => {
    const id = Number(c.req.param('id'));
    deletePost(ctx, id);
    return c.json({ data: { ok: true } });
  });

  return app;
}
