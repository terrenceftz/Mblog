import { describe, it, expect, beforeAll } from 'vitest';
import { makeTestApp, loginAsAdmin, authHeaders } from './helpers';

describe('photos album', () => {
  const { app } = makeTestApp();
  let token = '';

  beforeAll(async () => {
    token = await loginAsAdmin(app);
  });

  it('创建照片支持 album 分组', async () => {
    const res = await app.request('/api/admin/photos', {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({ url: '/uploads/a.jpg', title: 'A', album: '旅行' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.album).toBe('旅行');
  });

  it('更新照片 album 分组', async () => {
    const created = await app.request('/api/admin/photos', {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({ url: '/uploads/b.jpg', album: '旧相册' }),
    });
    const { data: row } = await created.json();
    const res = await app.request(`/api/admin/photos/${row.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({ album: '新相册' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.album).toBe('新相册');
  });

  it('公开接口返回 album 字段', async () => {
    const res = await app.request('/api/photos');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0]).toHaveProperty('album');
    expect(typeof body.data[0].album).toBe('string');
  });
});
