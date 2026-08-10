import { describe, it, expect, beforeAll } from 'vitest';
import { makeTestApp, loginAsAdmin, authHeaders } from './helpers';
import { resetRateLimit } from '../src/middleware/rateLimit';

describe('admin auth', () => {
  const { app } = makeTestApp();

  it('登录成功返回 token', async () => {
    const res = await app.request('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.token).toBeTruthy();
  });

  it('密码错误返回 401', async () => {
    const res = await app.request('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong' }),
    });
    expect(res.status).toBe(401);
  });

  it('未携带 token 访问受保护路由返回 401', async () => {
    const res = await app.request('/api/admin/posts');
    expect(res.status).toBe(401);
  });

  it('无效 token 访问受保护路由返回 401', async () => {
    const res = await app.request('/api/admin/posts', {
      headers: { Authorization: 'Bearer not-a-real-token' },
    });
    expect(res.status).toBe(401);
  });

  it('登录接口限流（连续 5 次失败后第 6 次 429）', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await app.request('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'wrong' }),
      });
      expect(res.status).toBe(401);
    }
    const res = await app.request('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe('RATE_LIMITED');
  });
});

describe('admin categories', () => {
  const { app } = makeTestApp();
  let token = '';

  beforeAll(async () => {
    resetRateLimit(); // admin auth 的限流用例会占满共享桶，登录前先清空
    token = await loginAsAdmin(app);
  });

  it('创建、列出、更新、删除分类', async () => {
    const headers = authHeaders(token);
    const create = await app.request('/api/admin/categories', {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ name: '前端' }),
    });
    expect(create.status).toBe(201);

    const list = await app.request('/api/admin/categories', { headers });
    const body = await list.json();
    expect(body.data[0].name).toBe('前端');

    const update = await app.request('/api/admin/categories/1', {
      method: 'PUT', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ name: '前端开发' }),
    });
    expect(update.status).toBe(200);

    const del = await app.request('/api/admin/categories/1', { method: 'DELETE', headers });
    expect(del.status).toBe(200);
  });
});

describe('admin tags', () => {
  const { app } = makeTestApp();
  let token = '';

  beforeAll(async () => {
    resetRateLimit();
    token = await loginAsAdmin(app);
  });

  it('标签 CRUD', async () => {
    const headers = authHeaders(token);
    const create = await app.request('/api/admin/tags', {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Vue' }),
    });
    expect(create.status).toBe(201);
    const list = await app.request('/api/admin/tags', { headers });
    const body = await list.json();
    expect(body.data[0].name).toBe('Vue');

    const update = await app.request('/api/admin/tags/1', {
      method: 'PUT', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Vue3' }),
    });
    expect(update.status).toBe(200);

    const del = await app.request('/api/admin/tags/1', { method: 'DELETE', headers });
    expect(del.status).toBe(200);
  });
});

describe('admin posts', () => {
  const { app, ctx } = makeTestApp();
  let token = '';

  beforeAll(async () => {
    resetRateLimit();
    token = await loginAsAdmin(app);
  });

  it('文章 CRUD（含 FTS 搜索与渲染）', async () => {
    const headers = authHeaders(token);
    const create = await app.request('/api/admin/posts', {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Hello World', contentMd: '# 测试\n\n正文内容', status: 'published' }),
    });
    expect(create.status).toBe(201);

    const detail = await app.request('/api/admin/posts/1', { headers });
    const d = await detail.json();
    expect(d.data.contentHtml).toContain('<h1>测试</h1>');

    // 公开搜索能命中（CJK 逐字分词）
    const search = await app.request('/api/posts?q=正文');
    const s = await search.json();
    expect(s.data.total).toBe(1);

    const update = await app.request('/api/admin/posts/1', {
      method: 'PUT', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Hello Updated', contentMd: '新内容', status: 'published' }),
    });
    expect(update.status).toBe(200);

    const del = await app.request('/api/admin/posts/1', { method: 'DELETE', headers });
    expect(del.status).toBe(200);
    const gone = await app.request('/api/posts/hello-updated');
    expect(gone.status).toBe(404);
  });
});

describe('admin comments', () => {
  const { app, ctx } = makeTestApp();
  let token = '';

  beforeAll(async () => {
    resetRateLimit();
    token = await loginAsAdmin(app);
  });

  it('评论审核、回复与批量操作', async () => {
    const headers = authHeaders(token);
    // 建一篇已发布文章
    const postRes = await app.request('/api/admin/posts', {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'P', contentMd: 'x', status: 'published' }),
    });
    expect(postRes.status).toBe(201);
    // 访客发表一条评论（待审核）
    const commentRes = await app.request('/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ postId: 1, author: '访客', content: '好文' }),
    });
    expect(commentRes.status).toBe(201);

    // 管理员通过
    const approve = await app.request('/api/admin/comments/1', {
      method: 'PATCH', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    expect(approve.status).toBe(200);
    const list = await app.request('/api/admin/comments?status=approved', { headers });
    const listBody = await list.json();
    expect(listBody.data.length).toBeGreaterThanOrEqual(1);

    // 管理员回复（直接 approved）
    const reply = await app.request('/api/admin/comments/1/reply', {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ content: '感谢支持' }),
    });
    expect(reply.status).toBe(201);

    // 批量通过一条待审评论（先发第二条评论）
    await app.request('/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ postId: 1, author: '路人', content: '第二条' }),
    });
    const batch = await app.request('/api/admin/comments/batch', {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ ids: [3], action: 'approve' }),
    });
    expect(batch.status).toBe(200);
    // 删除一条评论
    const del = await app.request('/api/admin/comments/2', { method: 'DELETE', headers });
    expect(del.status).toBe(200);
  });
});

describe('admin friend links', () => {
  const { app } = makeTestApp();
  let token = '';

  beforeAll(async () => {
    resetRateLimit();
    token = await loginAsAdmin(app);
  });

  it('友链审核', async () => {
    const headers = authHeaders(token);
    // 访客申请一条（待审核）
    const apply = await app.request('/api/friend-links', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '待审站', url: 'https://pending.example' }),
    });
    expect(apply.status).toBe(201);

    // 管理员通过
    const approve = await app.request('/api/admin/friend-links/1', {
      method: 'PUT', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    expect(approve.status).toBe(200);

    // 公开列表能看到
    const pub = await app.request('/api/friend-links');
    const pubBody = await pub.json();
    expect(pubBody.data.length).toBe(1);

    // 删除
    const del = await app.request('/api/admin/friend-links/1', { method: 'DELETE', headers });
    expect(del.status).toBe(200);
  });
});

describe('admin upload & stats', () => {
  const { app } = makeTestApp();
  let token = '';

  beforeAll(async () => {
    resetRateLimit();
    token = await loginAsAdmin(app);
  });

  it('上传图片并记录媒体文件', async () => {
    const headers = authHeaders(token);
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }), 'a.png');
    const res = await app.request('/api/admin/upload', {
      method: 'POST',
      headers,
      body: form,
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.url).toMatch(/^\/uploads\//);

    const media = await app.request('/api/admin/media', { headers });
    const mediaBody = await media.json();
    expect(mediaBody.data.total).toBe(1);
  });

  it('统计接口', async () => {
    const headers = authHeaders(token);
    const res = await app.request('/api/admin/stats', { headers });
    const body = await res.json();
    expect(body.data).toHaveProperty('postTotal');
    expect(body.data).toHaveProperty('pendingComments');
    expect(body.data).toHaveProperty('totalViews');
  });
});

describe('admin settings', () => {
  const { app } = makeTestApp();
  let token = '';

  beforeAll(async () => {
    resetRateLimit();
    token = await loginAsAdmin(app);
  });

  it('设置读写与 COS 密钥掩码', async () => {
    const headers = authHeaders(token);
    // 先写入真实密钥
    const put = await app.request('/api/admin/settings', {
      method: 'PUT', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ site_name: '我的新博客', default_theme: 'reader', cos_secret_key: 'real-secret-123' }),
    });
    expect(put.status).toBe(200);
    const putBody = await put.json();
    expect(putBody.data.site_name).toBe('我的新博客');
    expect(putBody.data.cos_secret_key).toBe('********'); // 掩码返回

    // 再用掩码 PUT，密钥应保留
    const put2 = await app.request('/api/admin/settings', {
      method: 'PUT', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ cos_secret_key: '********' }),
    });
    expect(put2.status).toBe(200);

    // 公开设置反映默认主题变更
    const pub = await app.request('/api/settings/public');
    const pubBody = await pub.json();
    expect(pubBody.data.theme).toBe('reader');
  });
});
