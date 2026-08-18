import { Hono } from 'hono';
import { eq, desc, and, count, inArray } from 'drizzle-orm';
import { comments } from '../../db/schema';
import { getSetting } from '../../lib/settings';
import { sendEmail, escapeHtml } from '../../lib/mailer';
import type { Db } from '../../db';

export function commentsAdminRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/comments', (c) => {
    const status = c.req.query('status');
    const conditions = [];
    if (status === 'pending' || status === 'approved' || status === 'rejected') {
      conditions.push(eq(comments.status, status));
    }
    const where = and(...conditions);
    const total = ctx.db.select({ n: count() }).from(comments).where(where).get()?.n ?? 0;
    const rawPage = Number(c.req.query('page') ?? 1);
    const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
    const rawSize = Number(c.req.query('pageSize') ?? 20);
    const pageSize = Number.isInteger(rawSize) && rawSize >= 1 ? Math.min(100, rawSize) : 20;
    const rows = ctx.db
      .select()
      .from(comments)
      .where(where)
      .orderBy(desc(comments.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .all();
    return c.json({ data: { list: rows, total } });
  });

  app.patch('/comments/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => null);
    const status = body?.status;
    if (status !== 'approved' && status !== 'rejected' && status !== 'pending') {
      return c.json({ error: { code: 'INVALID', message: '无效状态' } }, 400);
    }
    const row = ctx.db.select().from(comments).where(eq(comments.id, id)).get();
    if (!row) return c.json({ error: { code: 'NOT_FOUND', message: '评论不存在' } }, 404);
    ctx.db.update(comments).set({ status }).where(eq(comments.id, id)).run();
    return c.json({ data: { id, status } });
  });

  app.post('/comments/:id/reply', async (c) => {
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => null);
    const content = typeof body?.content === 'string' ? body.content.trim().slice(0, 2000) : '';
    if (!content) return c.json({ error: { code: 'INVALID', message: '回复内容不能为空' } }, 400);
    const parent = ctx.db.select().from(comments).where(eq(comments.id, id)).get();
    if (!parent) return c.json({ error: { code: 'NOT_FOUND', message: '评论不存在' } }, 404);
    ctx.db.insert(comments).values({
      postId: parent.postId, author: '博主', content, status: 'approved', parentId: id,
    }).run();

    // 邮件提醒原评论者：TA 的评论收到了博主回复（原评论留了邮箱才发；SMTP 未配置静默跳过）
    if (parent.email) {
      const siteName = getSetting(ctx, 'site_name');
      const siteUrl = getSetting(ctx, 'site_url');
      sendEmail(
        ctx,
        parent.email,
        `你的评论在【${siteName || '博客'}】收到了回复`,
        `<p>${escapeHtml(parent.author)}，你在博客中的评论收到了新回复：</p>
         <blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#555;">${escapeHtml(content)}</blockquote>
         <p><a href="${siteUrl}/">回到博客看看</a></p>`,
      );
    }

    return c.json({ data: { ok: true } }, 201);
  });

  app.post('/comments/batch', async (c) => {
    const body = await c.req.json().catch(() => null);
    const ids = Array.isArray(body?.ids) ? body.ids.map(Number) : [];
    const action = body?.action;
    if (ids.length === 0) return c.json({ error: { code: 'INVALID', message: '缺少 ids' } }, 400);
    if (action === 'delete') {
      ctx.db.delete(comments).where(inArray(comments.id, ids)).run();
    } else if (action === 'approve' || action === 'reject') {
      const status = action === 'reject' ? 'rejected' : 'approved';
      ctx.db.update(comments).set({ status }).where(inArray(comments.id, ids)).run();
    } else {
      return c.json({ error: { code: 'INVALID', message: '无效操作' } }, 400);
    }
    return c.json({ data: { ok: true } });
  });

  app.delete('/comments/:id', (c) => {
    const id = Number(c.req.param('id'));
    ctx.db.delete(comments).where(eq(comments.id, id)).run();
    return c.json({ data: { ok: true } });
  });

  return app;
}
