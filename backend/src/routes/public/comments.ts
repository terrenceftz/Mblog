import { Hono } from 'hono';
import { eq, and, asc } from 'drizzle-orm';
import { comments, posts } from '../../db/schema';
import { rateLimit } from '../../middleware/rateLimit';
import type { Db } from '../../db';

export function commentsRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/comments', (c) => {
    const postId = Number(c.req.query('post_id'));
    if (!postId || !Number.isInteger(postId)) {
      return c.json({ error: { code: 'INVALID', message: '缺少有效的 post_id' } }, 400);
    }
    // 只暴露公开字段，不返回 email/ip
    const rows = ctx.db
      .select({
        id: comments.id,
        postId: comments.postId,
        author: comments.author,
        content: comments.content,
        parentId: comments.parentId,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .where(and(eq(comments.postId, postId), eq(comments.status, 'approved')))
      .orderBy(asc(comments.createdAt))
      .all();
    return c.json({ data: rows });
  });

  app.post('/comments', rateLimit(10, 60_000), async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.postId !== 'number' || typeof body.author !== 'string' || typeof body.content !== 'string') {
      return c.json({ error: { code: 'INVALID', message: '参数错误' } }, 400);
    }
    const author = body.author.trim().slice(0, 50);
    const content = body.content.trim().slice(0, 2000);
    const email = typeof body.email === 'string' ? body.email.trim().slice(0, 100) : '';
    if (!author || !content) return c.json({ error: { code: 'INVALID', message: '昵称和内容不能为空' } }, 400);

    const post = ctx.db
      .select()
      .from(posts)
      .where(and(eq(posts.id, body.postId), eq(posts.status, 'published')))
      .get();
    if (!post) return c.json({ error: { code: 'NOT_FOUND', message: '文章不存在' } }, 404);

    const parentId = typeof body.parentId === 'number' ? body.parentId : null;
    if (parentId !== null) {
      const parent = ctx.db.select({ id: comments.id }).from(comments).where(eq(comments.id, parentId)).get();
      if (!parent) return c.json({ error: { code: 'INVALID', message: '回复的评论不存在' } }, 400);
    }

    const ip =
      c.req.header('x-real-ip')?.trim() ||
      c.req.header('x-forwarded-for')?.split(',').pop()?.trim() ||
      'unknown';

    ctx.db.insert(comments).values({ postId: post.id, author, email, content, ip, status: 'pending', parentId }).run();
    return c.json({ data: { message: '评论已提交，等待审核' } }, 201);
  });

  return app;
}
