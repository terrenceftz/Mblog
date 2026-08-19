import { Hono } from 'hono';
import { eq, and, asc } from 'drizzle-orm';
import { comments, posts } from '../../db/schema';
import { rateLimit } from '../../middleware/rateLimit';
import { createCaptcha, verifyCaptcha } from '../../lib/captcha';
import { verifyTurnstile } from '../../lib/turnstile';
import { getSetting } from '../../lib/settings';
import { sendEmail, escapeHtml } from '../../lib/mailer';
import { clientIp } from '../../lib/clientIp';
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

    // 评论 IP 与限流同一套解析（TRUST_PROXY 控制是否信任代理头），拿不到时存 'unknown'
    const ip = clientIp(c) ?? 'unknown';

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

    // 邮件订阅开关：仅在留了邮箱时生效（被回复时通知该评论作者）
    const notify = email && body.notify === true ? 1 : 0;

    ctx.db.insert(comments).values({ postId: post.id, author, email, website, content, ip, status: 'pending', parentId, notify }).run();

    // 邮件通知博主：新评论待审核（SMTP 未配置时静默跳过，失败不影响主流程）
    const notifyTo = getSetting(ctx, 'notify_email');
    if (notifyTo) {
      const siteName = getSetting(ctx, 'site_name');
      const siteUrl = getSetting(ctx, 'site_url');
      sendEmail(
        ctx,
        notifyTo,
        `【${siteName || '博客'}】新评论待审核：${author}`,
        `<p><strong>${escapeHtml(author)}</strong> 在《${escapeHtml(post.title)}》下发表了新评论：</p>
         <blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#555;">${escapeHtml(content)}</blockquote>
         <p><a href="${siteUrl}/admin/comments">前往后台审核</a></p>`,
      );
    }

    // 订阅通知：回复了开了订阅的评论 → 通知原评论者（TA 的评论过审后才会显示，这里只提醒"收到了回复"）
    if (parentId !== null) {
      const parent = ctx.db
        .select({ notify: comments.notify, email: comments.email, author: comments.author })
        .from(comments)
        .where(eq(comments.id, parentId))
        .get();
      if (parent?.notify === 1 && parent.email) {
        const siteName = getSetting(ctx, 'site_name');
        const siteUrl = getSetting(ctx, 'site_url');
        sendEmail(
          ctx,
          parent.email,
          `你订阅的评论在【${siteName || '博客'}】收到了新回复`,
          `<p>${escapeHtml(parent.author)}，你订阅的评论收到了新回复：</p>
           <blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#555;">${escapeHtml(content)}</blockquote>
           <p>回复将在审核通过后展示。<a href="${siteUrl}/post/${post.slug}">回到文章</a>（回复仅在过审后可见）</p>
           <p style="color:#999;font-size:12px;">你在评论时选择了"有回复时邮件通知"。此通知基于这条评论的订阅开关，无需退订操作。</p>`,
        );
      }
    }

    return c.json({ data: { message: '评论已提交，等待审核' } }, 201);
  });

  return app;
}
