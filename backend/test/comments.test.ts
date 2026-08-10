import { describe, it, expect } from 'vitest';
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
});
