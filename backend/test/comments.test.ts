import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestApp } from './helpers';
import { posts, comments } from '../src/db/schema';

describe('public comments', () => {
  const { app, ctx } = makeTestApp();

  it('发表评论进入待审核', async () => {
    ctx.db.insert(posts).values({ title: 't', slug: 't', status: 'published', contentMd: '', contentHtml: '' }).run();
    const res = await app.request('/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ postId: 1, author: '小明', content: '写得好' }),
    });
    expect(res.status).toBe(201);
    const rows = ctx.db.select().from(comments).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('pending');
  });

  it('评论列表只返回已审核评论', async () => {
    ctx.db.insert(posts).values({ title: 'p', slug: 'p', status: 'published', contentMd: '', contentHtml: '' }).run();
    ctx.db.insert(comments).values([
      { postId: 1, author: 'a', content: 'approved', status: 'approved' },
      { postId: 1, author: 'b', content: 'pending', status: 'pending' },
    ]).run();
    const res = await app.request('/api/comments?post_id=1');
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].content).toBe('approved');
    expect(body.data[0]).not.toHaveProperty('email');
    expect(body.data[0]).not.toHaveProperty('ip');
  });

  it('不存在的文章不可评论', async () => {
    const res = await app.request('/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ postId: 999, author: 'a', content: 'x' }),
    });
    expect(res.status).toBe(404);
  });

  it('缺少 post_id 返回 400', async () => {
    const res = await app.request('/api/comments');
    expect(res.status).toBe(400);
  });


  it('评论支持个人网站字段（校验与公开返回）', async () => {
    ctx.db.insert(posts).values({ title: 'w', slug: 'w', status: 'published', contentMd: '', contentHtml: '' }).run();
    // 非法网站 → 400
    const bad = await app.request('/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ postId: 1, author: 'a', content: 'x', website: 'not-a-url' }),
    });
    expect(bad.status).toBe(400);
    // 合法网站 → 201 入库
    const ok = await app.request('/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ postId: 1, author: '小明', content: '你好', website: 'https://example.com' }),
    });
    expect(ok.status).toBe(201);
    // 审核后公开列表返回 website，但不暴露 email/ip
    const created = ctx.db.select({ id: comments.id }).from(comments).where(eq(comments.website, 'https://example.com')).get();
    ctx.db.update(comments).set({ status: 'approved' }).where(eq(comments.id, created.id)).run();
    const list = await app.request('/api/comments?post_id=1');
    const body = await list.json();
    const mine = body.data.find((c: { website: string }) => c.website === 'https://example.com');
    expect(mine).toBeTruthy();
    expect(mine.author).toBe('小明');
    expect(mine).not.toHaveProperty('email');
    expect(mine).not.toHaveProperty('ip');
  });

  it('友链列表只返回已审核', async () => {
    const res = await app.request('/api/friend-links', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '示例站', url: 'https://example.com', description: '你好' }),
    });
    expect(res.status).toBe(201);
    const listRes = await app.request('/api/friend-links');
    const list = await listRes.json();
    expect(list.data).toHaveLength(0); // 待审核，不展示
    // 隐私：不返回 status 字段
    expect(list.data[0]).toBeUndefined();
  });
});
