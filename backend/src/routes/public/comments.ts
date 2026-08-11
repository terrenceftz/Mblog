import { Hono } from 'hono';
import { eq, and, asc } from 'drizzle-orm';
import { comments, posts } from '../../db/schema';
import { rateLimit } from '../../middleware/rateLimit';
import { createCaptcha, verifyCaptcha } from '../../lib/captcha';
import { verifyTurnstile } from '../../lib/turnstile';
import { getSetting } from '../../lib/settings';
import type { Db } from '../../db';

export function commentsRoutes(ctx: Db) {
  const app = new Hono();

  // 评论验证码（防机器人）：返回一道数学题
  app.get('/comments/captcha', (c) => c.json({ data: createCaptcha() }));

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
        website: comments.website,
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
    // 蜜罐字段：真人不填，机器人自动填充 → 直接拒绝
    if (typeof body._hp === 'string' && body._hp.trim() !== '') {
      return c.json({ error: { code: 'INVALID', message: '参数错误' } }, 400);
    }

    const ip =
      c.req.header('x-real-ip')?.trim() ||
      c.req.header('x-forwarded-for')?.split(',').pop()?.trim() ||
      'unknown';

    // 云验证（Turnstile）：配置了 Secret Key 就走云验证；未配置回落数学验证码
    const turnstileSecret = getSetting(ctx, 'turnstile_secret_key');
    if (turnstileSecret) {
      const token = typeof body.cfTurnstileToken === 'string' ? body.cfTurnstileToken : '';
      if (!token || !(await verifyTurnstile(token, turnstileSecret, ip === 'unknown' ? undefined : ip))) {
        return c.json({ error: { code: 'CAPTCHA_FAILED', message: '人机验证未通过，请重试' } }, 400);
      }
    } else if (!verifyCaptcha(body.captchaId, body.captchaAnswer)) {
      return c.json({ error: { code: 'CAPTCHA_FAILED', message: '验证码不正确或已过期' } }, 400);
    }
    const author = body.author.trim().slice(0, 50);
    const content = body.content.trim().slice(0, 2000);
    const email = typeof body.email === 'string' ? body.email.trim().slice(0, 100) : '';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return c.json({ error: { code: 'INVALID', message: '邮箱格式不正确' } }, 400);
    }
    const website = typeof body.website === 'string' ? body.website.trim().slice(0, 200) : '';
    if (website && !/^https?:\/\/.+/i.test(website)) {
      return c.json({ error: { code: 'INVALID', message: '个人网站需以 http(s):// 开头' } }, 400);
    }
    if (!author || !content) return c.json({ error: { code: 'INVALID', message: '昵称和内容不能为空' } }, 400);

    const post = ctx.db
      .select()
      .from(posts)
      .where(and(eq(posts.id, body.postId), eq(posts.status, 'published')))
      .get();
    if (!post) return c.json({ error: { code: 'NOT_FOUND', message: '文章不存在' } }, 404);

    const parentId = typeof body.parentId === 'number' ? body.parentId : null;
    if (parentId !== null) {
      const parent = ctx.db
        .select({ id: comments.id, postId: comments.postId, status: comments.status })
        .from(comments)
        .where(eq(comments.id, parentId))
        .get();
      if (!parent || parent.postId !== post.id || parent.status !== 'approved') {
        return c.json({ error: { code: 'INVALID', message: '回复的评论不存在或不可回复' } }, 400);
      }
    }

    ctx.db.insert(comments).values({ postId: post.id, author, email, website, content, ip, status: 'pending', parentId }).run();
    return c.json({ data: { message: '评论已提交，等待审核' } }, 201);
  });

  return app;
}
