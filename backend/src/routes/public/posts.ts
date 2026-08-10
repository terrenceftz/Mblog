import { Hono } from 'hono';
import { eq, and, desc, count, inArray } from 'drizzle-orm';
import { posts, postTags, tags, categories } from '../../db/schema';
import type { Db } from '../../db';

export function postsRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/posts', async (c) => {
    const page = Math.max(1, Number(c.req.query('page') ?? 1));
    const pageSize = Math.min(50, Math.max(1, Number(c.req.query('pageSize') ?? 10)));
    const categorySlug = c.req.query('category')?.trim();
    const tagSlug = c.req.query('tag')?.trim();
    const q = c.req.query('q')?.trim();

    const conditions = [eq(posts.status, 'published')];

    if (categorySlug) {
      const cat = ctx.db.select({ id: categories.id }).from(categories).where(eq(categories.slug, categorySlug)).get();
      if (!cat) return c.json({ data: { list: [], total: 0 } });
      conditions.push(eq(posts.categoryId, cat.id));
    }

    if (tagSlug) {
      const tag = ctx.db.select({ id: tags.id }).from(tags).where(eq(tags.slug, tagSlug)).get();
      if (!tag) return c.json({ data: { list: [], total: 0 } });
      const postIds = ctx.db
        .select({ postId: postTags.postId })
        .from(postTags)
        .where(eq(postTags.tagId, tag.id))
        .all()
        .map((r) => r.postId);
      conditions.push(inArray(posts.id, postIds.length ? postIds : [0]));
    }

    if (q) {
      // FTS5 全文搜索，简单去除引号避免语法错误
      const safeQ = q.replace(/"/g, ' ');
      const rows = ctx.sqlite
        .prepare('SELECT rowid AS id FROM posts_fts WHERE posts_fts MATCH ? ORDER BY rank LIMIT 200')
        .all(safeQ) as { id: number }[];
      if (rows.length === 0) return c.json({ data: { list: [], total: 0 } });
      conditions.push(inArray(posts.id, rows.map((r) => r.id)));
    }

    const where = and(...conditions);
    const total = ctx.db.select({ n: count() }).from(posts).where(where).get()?.n ?? 0;
    const list = ctx.db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        summary: posts.summary,
        cover: posts.cover,
        viewCount: posts.viewCount,
        categoryId: posts.categoryId,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .where(where)
      .orderBy(desc(posts.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .all();

    return c.json({ data: { list, total } });
  });

  app.get('/posts/:slug', async (c) => {
    const slug = c.req.param('slug');
    const post = ctx.db
      .select()
      .from(posts)
      .where(and(eq(posts.slug, slug), eq(posts.status, 'published')))
      .get();
    if (!post) return c.json({ error: { code: 'NOT_FOUND', message: '文章不存在' } }, 404);

    // contentHtml 由写入时渲染存储（见 services/posts.ts）；此处返回存储值，仅递增阅读量
    const viewCount = post.viewCount + 1;
    ctx.db.update(posts).set({ viewCount }).where(eq(posts.id, post.id)).run();

    const postTagList = ctx.db
      .select({ name: tags.name, slug: tags.slug })
      .from(postTags)
      .innerJoin(tags, eq(postTags.tagId, tags.id))
      .where(eq(postTags.postId, post.id))
      .all();
    const category = post.categoryId
      ? ctx.db.select().from(categories).where(eq(categories.id, post.categoryId)).get()
      : null;

    return c.json({ data: { ...post, viewCount, tags: postTagList, category } });
  });

  return app;
}
