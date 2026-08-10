import { describe, it, expect } from 'vitest';
import { makeTestApp } from './helpers';

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
