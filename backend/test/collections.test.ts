import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestApp, loginAsAdmin, authHeaders } from './helpers';
import { collections, posts } from '../src/db/schema';

describe('collections', () => {
  const { app, ctx } = makeTestApp();
  let token = '';

  beforeAll(async () => {
    token = await loginAsAdmin(app);
  });

  it('管理端创建合集 + slug 唯一约束', async () => {
    const r = await app.request('/api/admin/collections', {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'vibe-coding 系列', slug: 'vibe-coding', description: 'AI 结对写作实验' }),
    });
    expect(r.status).toBe(201);
    const dup = await app.request('/api/admin/collections', {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({ name: '另一个', slug: 'vibe-coding' }),
    });
    expect(dup.status).toBe(409);
  });

  it('文章可归入合集，公开列表按合集过滤，详情带合集', async () => {
    const col = ctx.db.select().from(collections).where(eq(collections.slug, 'vibe-coding')).get()!;
    ctx.db.insert(posts).values([
      { title: '系列一', slug: 'col-p1', status: 'published', contentMd: 'a', contentHtml: 'a', collectionId: col.id },
      { title: '系列二', slug: 'col-p2', status: 'published', contentMd: 'b', contentHtml: 'b', collectionId: col.id },
      { title: '散篇', slug: 'col-p3', status: 'published', contentMd: 'c', contentHtml: 'c' },
    ]).run();
    const res = await app.request('/api/posts?collection=vibe-coding');
    const body = await res.json();
    expect(body.data.total).toBe(2);

    const detail = await app.request('/api/posts/col-p1');
    const d = await detail.json();
    expect(d.data.collection.slug).toBe('vibe-coding');
    const noCol = await app.request('/api/posts/col-p3');
    const d2 = await noCol.json();
    expect(d2.data.collection).toBeNull();
  });

  it('公开合集列表只算已发布文章', async () => {
    const col = ctx.db.select().from(collections).all()[0];
    ctx.db.insert(posts).values({ title: '草稿', slug: 'col-draft', status: 'draft', contentMd: '', contentHtml: '', collectionId: col.id }).run();
    const res = await app.request('/api/collections');
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].postCount).toBe(2); // 草稿不计
  });

  it('删除合集时文章合集字段置空', async () => {
    const col = ctx.db.select().from(collections).all()[0];
    const res = await app.request(`/api/admin/collections/${col.id}`, { method: 'DELETE', headers: authHeaders(token) });
    expect(res.status).toBe(200);
    const orphan = ctx.db.select().from(posts).where(eq(posts.slug, 'col-p1')).get();
    expect(orphan?.collectionId).toBeNull();
    const remaining = ctx.db.select().from(collections).all();
    expect(remaining).toHaveLength(0);
  });
});
