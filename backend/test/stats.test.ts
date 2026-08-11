import { describe, it, expect } from 'vitest';
import { makeTestApp, loginAsAdmin, authHeaders } from './helpers';

describe('公共统计接口 /api/stats', () => {
  it('返回文章/评论/浏览/友链统计', async () => {
    const { app } = makeTestApp();
    // 造数：1 篇发布 + 1 篇草稿、1 条已审评论、1 条已审友链 + 1 条待审友链
    const token = await loginAsAdmin(app);
    const post = (body: unknown) =>
      app.request('/api/admin/posts', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify(body),
      });
    const post1 = await post({ title: '发布文', slug: 'pub', contentMd: '# hi', status: 'published' });
    await post({ title: '草稿文', slug: 'draft', contentMd: '# hi', status: 'draft' });
    expect(post1.status).toBe(201);

    // 评论：公开发表（挂到已发布的 post 1），默认 pending
    const commentRes = await app.request('/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ postId: 1, author: 'a', email: 'a@a.com', content: 'x' }),
    });
    expect(commentRes.status).toBe(201);

    // 友链：公开申请一条（pending）
    const linkRes = await app.request('/api/friend-links', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'F', url: 'https://f.com' }),
    });
    expect(linkRes.status).toBe(201);

    // 审批：评论 PATCH /api/admin/comments/:id，友链 PUT /api/admin/friend-links/:id
    const approveComments = async () => {
      const list = (await (await app.request('/api/admin/comments', { headers: authHeaders(token) })).json()) as { data: { id: number }[] };
      for (const c of list.data) {
        const res = await app.request(`/api/admin/comments/${c.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', ...authHeaders(token) },
          body: JSON.stringify({ status: 'approved' }),
        });
        expect(res.status).toBe(200);
      }
    };
    const approveFriendLinks = async () => {
      const list = (await (await app.request('/api/admin/friend-links', { headers: authHeaders(token) })).json()) as { data: { id: number }[] };
      for (const f of list.data) {
        const res = await app.request(`/api/admin/friend-links/${f.id}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json', ...authHeaders(token) },
          body: JSON.stringify({ status: 'approved' }),
        });
        expect(res.status).toBe(200);
      }
    };
    await approveComments();
    await approveFriendLinks();

    // 再提交一条待审友链，验证 friendLinkCount 只统计 approved
    await app.request('/api/friend-links', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'G', url: 'https://g.com' }),
    });

    const res = await app.request('/api/stats');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { postTotal: number; commentTotal: number; totalViews: number; friendLinkCount: number } };
    expect(body.data.postTotal).toBe(1); // 仅发布
    expect(body.data.commentTotal).toBe(1);
    expect(body.data.friendLinkCount).toBe(1); // 仅 approved（另一条 pending 不计）
    expect(body.data.totalViews).toBeGreaterThanOrEqual(0);
  });
});
