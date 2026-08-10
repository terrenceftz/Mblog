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
