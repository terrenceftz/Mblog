import { describe, it, expect } from 'vitest';
import { makeTestApp } from './helpers';
import { posts, categories, tags, postTags } from '../src/db/schema';

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

  it('草稿详情返回 404', async () => {
    ctx.db.insert(posts).values({ title: '草稿', slug: 'draft-2', status: 'draft', contentMd: '', contentHtml: '' }).run();
    const res = await app.request('/api/posts/draft-2');
    expect(res.status).toBe(404);
  });

  it('非法分页参数不返回 500 也不泄露全表', async () => {
    const res = await app.request('/api/posts?page=abc&pageSize=1.5');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.list.length).toBeLessThanOrEqual(10);
  });

  it('FTS 特殊字符不返回 500', async () => {
    for (const q of ['*', '(', 'node-js', 'Hono OR Alpha']) {
      const res = await app.request(`/api/posts?q=${encodeURIComponent(q)}`);
      expect(res.status).toBe(200);
    }
  });

  it('返回分类列表（含已发布文章数）', async () => {
    const cat = ctx.db.insert(categories).values({ name: '前端', slug: 'frontend' }).returning({ id: categories.id }).get();
    ctx.db.insert(posts).values([
      { title: 'a', slug: 'a', status: 'published', contentMd: '', categoryId: cat.id },
      { title: '草稿', slug: 'a-draft', status: 'draft', contentMd: '', categoryId: cat.id },
    ]).run();
    const res = await app.request('/api/categories');
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].name).toBe('前端');
    expect(body.data[0].postCount).toBe(1);
  });

  it('返回标签列表（只统计已发布文章）', async () => {
    ctx.db.insert(tags).values({ name: 'Vue', slug: 'vue' }).run();
    const pub = ctx.db.insert(posts).values({ title: 'p', slug: 'p', status: 'published', contentMd: '' }).returning({ id: posts.id }).get();
    const draft = ctx.db.insert(posts).values({ title: 'd', slug: 'd', status: 'draft', contentMd: '' }).returning({ id: posts.id }).get();
    ctx.db.insert(postTags).values([{ postId: pub.id, tagId: 1 }, { postId: draft.id, tagId: 1 }]).run();
    const res = await app.request('/api/tags');
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].postCount).toBe(1); // 草稿不计入
  });

  it('RSS 输出 xml', async () => {
    const res = await app.request('/api/rss');
    expect(res.headers.get('content-type')).toContain('application/rss+xml');
    const text = await res.text();
    expect(text).toContain('<rss');
  });

  it('公开设置返回主题与站点名', async () => {
    const res = await app.request('/api/settings/public');
    const body = await res.json();
    expect(body.data.siteName).toBeTruthy();
    expect(body.data.theme).toBe('normal');
    // 导航菜单：默认含 6 项（含「项目」「影音」）
    expect(Array.isArray(body.data.navMenu)).toBe(true);
    expect(body.data.navMenu.length).toBe(6);
    expect(body.data.navMenu[0].label).toBe('首页');
  });

  it('归档按月份分组', async () => {
    ctx.db.insert(posts).values([
      { title: '旧文', slug: 'old', status: 'published', contentMd: '', contentHtml: '', createdAt: Date.parse('2025-01-15') },
      { title: '新文', slug: 'new', status: 'published', contentMd: '', contentHtml: '', createdAt: Date.parse('2026-08-01') },
    ]).run();
    const res = await app.request('/api/archive');
    const body = await res.json();
    expect(body.data.length).toBe(2);
    expect(body.data[0].month).toBe('2026-08'); // 新的在前
  });
});
