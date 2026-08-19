import { Hono } from 'hono';
import { eq, and, asc, desc, count, gt, inArray, lt, or } from 'drizzle-orm';
import { posts, postTags, tags, categories, collections } from '../../db/schema';
import { toSearchText } from '../../services/posts';
import { rateLimit } from '../../middleware/rateLimit';
import { clientIp } from '../../lib/clientIp';
import type { Db } from '../../db';

// 阅读量去重：同 IP+文章 1 小时窗口内只计一次（内存版，单实例够用；重启失效=允许重计，可接受）
const VIEW_DEDUP_MS = 60 * 60 * 1000;
const viewSeen = new Map<string, number>();
function shouldCountView(ip: string, slug: string): boolean {
  const key = `${ip}|${slug}`;
  const now = Date.now();
  const last = viewSeen.get(key);
  if (last && now - last < VIEW_DEDUP_MS) return false;
  viewSeen.set(key, now);
  // 顺带驱逐过期项，防内存无限增长
  if (viewSeen.size > 5000) {
    for (const [k, ts] of viewSeen) {
      if (now - ts >= VIEW_DEDUP_MS) viewSeen.delete(k);
    }
  }
  return true;
}

/** 仅测试用：清空阅读量去重窗口。 */
export function resetViewDedup(): void {
  viewSeen.clear();
}

export function postsRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/posts', async (c) => {
    // 分页参数加固：非法/小数一律回落默认值，防止 NaN 泄漏到 LIMIT/OFFSET
    const rawPage = Number(c.req.query('page') ?? 1);
    const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
    const rawSize = Number(c.req.query('pageSize') ?? 10);
    const pageSize = Number.isInteger(rawSize) && rawSize >= 1 ? Math.min(50, rawSize) : 10;
    const categorySlug = c.req.query('category')?.trim();
    const tagSlug = c.req.query('tag')?.trim();
    const collectionSlug = c.req.query('collection')?.trim();
    const q = c.req.query('q')?.trim();

    const conditions = [eq(posts.status, 'published')];

    if (categorySlug) {
      const cat = ctx.db.select({ id: categories.id }).from(categories).where(eq(categories.slug, categorySlug)).get();
      if (!cat) return c.json({ data: { list: [], total: 0 } });
      conditions.push(eq(posts.categoryId, cat.id));
    }

    if (collectionSlug) {
      const col = ctx.db.select({ id: collections.id }).from(collections).where(eq(collections.slug, collectionSlug)).get();
      if (!col) return c.json({ data: { list: [], total: 0 } });
      conditions.push(eq(posts.collectionId, col.id));
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
      // CJK 逐字分词 + FTS5 语法加固：特殊字符失去操作符语义；异常时兜底空结果
      const terms = toSearchText(q)
        .split(/\s+/)
        .filter(Boolean)
        .map((t) => `"${t.replace(/"/g, '')}"`);
      let rows: { id: number }[] = [];
      if (terms.length) {
        try {
          rows = ctx.sqlite
            .prepare('SELECT rowid AS id FROM posts_fts WHERE posts_fts MATCH ? ORDER BY rank LIMIT 200')
            .all(terms.join(' ')) as { id: number }[];
        } catch {
          rows = [];
        }
      }
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

    // 补每篇的标签（供列表页展示 #标签）
    const pageIds = list.map((p) => p.id);
    const tagRows = pageIds.length
      ? ctx.db
          .select({ postId: postTags.postId, name: tags.name, slug: tags.slug })
          .from(postTags)
          .innerJoin(tags, eq(postTags.tagId, tags.id))
          .where(inArray(postTags.postId, pageIds))
          .all()
      : [];
    const tagsByPost = new Map<number, { name: string; slug: string }[]>();
    for (const t of tagRows) {
      const arr = tagsByPost.get(t.postId) ?? [];
      arr.push({ name: t.name, slug: t.slug });
      tagsByPost.set(t.postId, arr);
    }
    const listWithTags = list.map((p) => ({ ...p, tags: tagsByPost.get(p.id) ?? [] }));

    return c.json({ data: { list: listWithTags, total } });
  });

  app.get('/posts/:slug', async (c) => {
    const slug = c.req.param('slug');
    const post = ctx.db
      .select({
        id: posts.id, title: posts.title, slug: posts.slug, summary: posts.summary,
        cover: posts.cover, categoryId: posts.categoryId, collectionId: posts.collectionId, status: posts.status,
        viewCount: posts.viewCount, likeCount: posts.likeCount, contentHtml: posts.contentHtml,
        createdAt: posts.createdAt, updatedAt: posts.updatedAt,
      })
      .from(posts)
      .where(and(eq(posts.slug, slug), eq(posts.status, 'published')))
      .get();
    if (!post) return c.json({ error: { code: 'NOT_FOUND', message: '文章不存在' } }, 404);

    // contentHtml 由写入时渲染存储（见 services/posts.ts）；此处返回存储值，仅递增阅读量
    // 单条 SQL 原子自增，避免 SELECT-then-SET 在并发下的丢更新；同 IP 1h 窗口去重防刷新刷量
    let viewCount = post.viewCount;
    if (shouldCountView(clientIp(c) ?? 'unknown', slug)) {
      const row = ctx.sqlite
        .prepare('UPDATE posts SET view_count = view_count + 1 WHERE id = ? RETURNING view_count')
        .get(post.id) as { view_count: number };
      viewCount = row.view_count;
    }

    const postTagList = ctx.db
      .select({ name: tags.name, slug: tags.slug })
      .from(postTags)
      .innerJoin(tags, eq(postTags.tagId, tags.id))
      .where(eq(postTags.postId, post.id))
      .all();
    const category = post.categoryId
      ? ctx.db.select().from(categories).where(eq(categories.id, post.categoryId)).get()
      : null;
    const collection = post.collectionId
      ? ctx.db
          .select({ id: collections.id, name: collections.name, slug: collections.slug, description: collections.description })
          .from(collections)
          .where(eq(collections.id, post.collectionId))
          .get() ?? null
      : null;

    // 上一篇 / 下一篇（按发布时间与 id 排序，时间相同按 id 兜底）
    const siblingCond = (dir: 'prev' | 'next') =>
      dir === 'prev'
        ? or(
            lt(posts.createdAt, post.createdAt),
            and(eq(posts.createdAt, post.createdAt), lt(posts.id, post.id)),
          )
        : or(
            gt(posts.createdAt, post.createdAt),
            and(eq(posts.createdAt, post.createdAt), gt(posts.id, post.id)),
          );
    const prev = ctx.db
      .select({ title: posts.title, slug: posts.slug })
      .from(posts)
      .where(and(eq(posts.status, 'published'), siblingCond('prev')))
      .orderBy(desc(posts.createdAt), desc(posts.id))
      .limit(1)
      .get() ?? null;
    const next = ctx.db
      .select({ title: posts.title, slug: posts.slug })
      .from(posts)
      .where(and(eq(posts.status, 'published'), siblingCond('next')))
      .orderBy(asc(posts.createdAt), asc(posts.id))
      .limit(1)
      .get() ?? null;

    return c.json({ data: { ...post, viewCount, tags: postTagList, category, collection, prev, next } });
  });

  // 合集列表（公开）：只含有已发布文章的合集 + 已发布篇数
  app.get('/collections', (c) => {
    const rows = ctx.db.select({
      id: collections.id,
      name: collections.name,
      slug: collections.slug,
      description: collections.description,
      postCount: count(posts.id),
    }).from(collections)
      .innerJoin(posts, and(eq(posts.collectionId, collections.id), eq(posts.status, 'published')))
      .groupBy(collections.id)
      .orderBy(collections.sortOrder)
      .all();
    return c.json({ data: rows });
  });

  // 点赞：原子自增并返回最新计数
  app.post('/posts/:slug/like', rateLimit(20, 60_000), (c) => {
    const slug = c.req.param('slug');
    const row = ctx.sqlite
      .prepare('UPDATE posts SET like_count = like_count + 1 WHERE slug = ? AND status = ? RETURNING like_count')
      .get(slug, 'published') as { like_count: number } | undefined;
    if (!row) return c.json({ error: { code: 'NOT_FOUND', message: '文章不存在' } }, 404);
    return c.json({ data: { likeCount: row.like_count } });
  });

  return app;
}
