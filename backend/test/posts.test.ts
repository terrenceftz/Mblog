import { describe, it, expect } from 'vitest';
import { makeTestApp } from './helpers';
import { posts } from '../src/db/schema';

describe('public posts', () => {
  const { app, ctx } = makeTestApp();

  it('返回已发布文章列表', async () => {
    ctx.db.insert(posts).values([
      { title: '第一篇文章', slug: 'first', status: 'published', contentMd: 'hi' },
      { title: '草稿', slug: 'draft-1', status: 'draft', contentMd: 'hidden' },
    ]).run();
    const res = await app.request('/api/posts');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.total).toBe(1);
    expect(body.data.list[0].slug).toBe('first');
  });

  it('详情返回渲染 HTML 并递增阅读量', async () => {
    ctx.db.insert(posts).values({
      title: '详情', slug: 'detail', status: 'published', contentMd: '# 标题',
      contentHtml: '<h1>标题</h1>', // 写入时渲染的值（服务层负责生成）
    }).run();
    const res = await app.request('/api/posts/detail');
    const body = await res.json();
    expect(body.data.contentHtml).toContain('<h1>标题</h1>');
    expect(body.data.viewCount).toBe(1);
    const again = await app.request('/api/posts/detail');
    const body2 = await again.json();
    expect(body2.data.viewCount).toBe(2);
  });

  it('不存在的文章返回 404', async () => {
    const res = await app.request('/api/posts/nope');
    expect(res.status).toBe(404);
  });

  it('支持关键词搜索', async () => {
    const row = ctx.db.insert(posts).values({
      title: 'TypeScript 教程', slug: 'ts', status: 'published', contentMd: 'Hono 很轻',
    }).returning({ id: posts.id }).get();
    ctx.sqlite.prepare('INSERT INTO posts_fts(rowid, title, content_md) VALUES (?, ?, ?)')
      .run(row.id, 'TypeScript 教程', 'Hono 很轻');
    const res = await app.request('/api/posts?q=Hono');
    const body = await res.json();
    expect(body.data.total).toBe(1);
    expect(body.data.list[0].slug).toBe('ts');
  });
});
