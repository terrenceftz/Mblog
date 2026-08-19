import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestApp, solveCaptcha, loginAsAdmin, authHeaders } from './helpers';
import { posts, comments, settings } from '../src/db/schema';
import { __setCreateTransport } from '../src/lib/mailer';
import type { Db } from '../src/db';

type Mail = { from: string; to: string; subject: string; html: string };
let sent: Mail[] = [];

// 替换 transporter 工厂：捕获 sendMail 调用，不真正触网
const fakeCreateTransport = ((_opts: unknown) => ({
  sendMail: async (mail: Mail) => {
    sent.push(mail);
    return { messageId: 'fake' };
  },
})) as unknown as typeof import('nodemailer').createTransport;

beforeEach(() => {
  sent = [];
  __setCreateTransport(fakeCreateTransport);
});

function enableSmtp(ctx: Db) {
  ctx.db.insert(settings).values([
    { key: 'smtp_host', value: 'smtp.test.com' },
    { key: 'smtp_from', value: 'blog@test.com' },
    { key: 'notify_email', value: 'admin@test.com' },
  ]).run();
}

describe('email notifications', () => {
  const { app, ctx } = makeTestApp();
  enableSmtp(ctx);
  ctx.db.insert(posts).values({ title: '文章', slug: 'p1', status: 'published', contentMd: '', contentHtml: '' }).run();

  it('新评论待审核时发邮件给博主', async () => {
    const res = await app.request('/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...(await solveCaptcha(app)), postId: 1, author: '小明', content: '写得好' }),
    });
    expect(res.status).toBe(201);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('admin@test.com');
    expect(sent[0].subject).toContain('新评论');
    expect(sent[0].html).toContain('写得好');
  });

  it('博主回复后提醒订阅了的原评论者（notify=1 才发）', async () => {
    const token = await loginAsAdmin(app);
    ctx.db.insert(comments).values([
      { postId: 1, author: '小明', email: 'xiaoming@test.com', content: '订阅评论', status: 'approved', notify: 1 },
      { postId: 1, author: '小红', email: 'xiaohong@test.com', content: '未订阅评论', status: 'approved', notify: 0 },
    ]).run();
    const sub = ctx.db.select().from(comments).where(eq(comments.email, 'xiaoming@test.com')).get()!;
    const unsub = ctx.db.select().from(comments).where(eq(comments.email, 'xiaohong@test.com')).get()!;
    const r1 = await app.request(`/api/admin/comments/${sub.id}/reply`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({ content: '谢谢支持' }),
    });
    expect(r1.status).toBe(201);
    expect(sent.some((m) => m.to === 'xiaoming@test.com' && m.subject.includes('回复'))).toBe(true);
    // 未订阅的不发
    await app.request(`/api/admin/comments/${unsub.id}/reply`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({ content: '你好' }),
    });
    expect(sent.some((m) => m.to === 'xiaohong@test.com')).toBe(false);
  });

  it('审核通过后通知评论者（仅首次转通过态）', async () => {
    const token = await loginAsAdmin(app);
    ctx.db.insert(comments).values({
      postId: 1, author: '路人甲', email: 'lu@test.com', content: '求过', status: 'pending',
    }).run();
    const row = ctx.db.select().from(comments).where(eq(comments.email, 'lu@test.com')).get()!;
    const r = await app.request(`/api/admin/comments/${row.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    expect(r.status).toBe(200);
    expect(sent.some((m) => m.to === 'lu@test.com' && m.subject.includes('通过审核'))).toBe(true);
    // 已通过态再 PATCH 不重发
    const before = sent.length;
    await app.request(`/api/admin/comments/${row.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    expect(sent.length).toBe(before);
  });

  it('访客回复订阅评论时通知原评论者', async () => {
    ctx.db.insert(comments).values({
      postId: 1, author: '楼主', email: 'host@test.com', content: '正文', status: 'approved', notify: 1,
    }).run();
    const parent = ctx.db.select().from(comments).where(eq(comments.email, 'host@test.com')).get()!;
    const res = await app.request('/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...(await solveCaptcha(app)), postId: 1, parentId: parent.id,
        author: '访客', content: '回复楼主', email: 'guest@test.com',
      }),
    });
    expect(res.status).toBe(201);
    expect(sent.some((m) => m.to === 'host@test.com' && m.subject.includes('新回复'))).toBe(true);
  });

  it('未配置 SMTP 时不发邮件', async () => {
    ctx.db.update(settings).set({ value: '' }).where(eq(settings.key, 'smtp_host')).run();
    const before = sent.length;
    const res = await app.request('/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...(await solveCaptcha(app)), postId: 1, author: '路人', content: '无通知' }),
    });
    expect(res.status).toBe(201);
    expect(sent.length).toBe(before);
  });
});
