import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { comments } from '../src/db/schema';
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

describe('admin change password', () => {
  const { app } = makeTestApp();
  let token = '';

  beforeAll(async () => {
    resetRateLimit();
    token = await loginAsAdmin(app);
  });

  it('未登录访问改密接口返回 401', async () => {
    const res = await app.request('/api/admin/password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ oldPassword: 'admin123', newPassword: 'new-secret-pass-123' }),
    });
    expect(res.status).toBe(401);
  });

  it('新密码过短返回 400 WEAK_PASSWORD', async () => {
    const headers = authHeaders(token);
    const res = await app.request('/api/admin/password', {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ oldPassword: 'admin123', newPassword: 'short' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('WEAK_PASSWORD');
  });

  it('原密码错误返回 401 INVALID_PASSWORD', async () => {
    const headers = authHeaders(token);
    const res = await app.request('/api/admin/password', {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ oldPassword: 'wrong-old', newPassword: 'new-secret-pass-123' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_PASSWORD');
  });

  it('正确修改密码后旧密码失效、新密码可登录', async () => {
    const headers = authHeaders(token);
    const res = await app.request('/api/admin/password', {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ oldPassword: 'admin123', newPassword: 'new-secret-pass-123' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.message).toBe('密码已更新');

    const oldLogin = await app.request('/api/admin/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await app.request('/api/admin/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'new-secret-pass-123' }),
    });
    expect(newLogin.status).toBe(200);
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

  it('无效 categoryId 返回 400', async () => {
    const headers = authHeaders(token);
    const res = await app.request('/api/admin/posts', {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Bad', contentMd: 'x', categoryId: 9999, status: 'draft' }),
    });
    expect(res.status).toBe(400);
  });

  it('无效 tagIds 返回 400', async () => {
    const headers = authHeaders(token);
    const res = await app.request('/api/admin/posts', {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'BadTag', contentMd: 'x', tagIds: [9999], status: 'draft' }),
    });
    expect(res.status).toBe(400);
  });

  it('重复 slug 返回 409', async () => {
    const headers = authHeaders(token);
    const create = await app.request('/api/admin/posts', {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'First', contentMd: 'x', slug: 'dup-slug', status: 'draft' }),
    });
    expect(create.status).toBe(201);
    const dup = await app.request('/api/admin/posts', {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Second', contentMd: 'x', slug: 'dup-slug', status: 'draft' }),
    });
    expect(dup.status).toBe(409);
  });

  it('更新不存在的文章返回 404', async () => {
    const headers = authHeaders(token);
    const res = await app.request('/api/admin/posts/9999', {
      method: 'PUT', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'No', contentMd: 'x' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
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

  it('批量拒绝写入 rejected 状态', async () => {
    const headers = authHeaders(token);
    const postRes = await app.request('/api/admin/posts', {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'P2', contentMd: 'x', status: 'published' }),
    });
    expect(postRes.status).toBe(201);
    // 访客发表一条评论（待审核）
    const commentRes = await app.request('/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ postId: 2, author: '批量拒绝访客', content: '待拒绝评论' }),
    });
    expect(commentRes.status).toBe(201);
    const row = ctx.db.select().from(comments).where(eq(comments.author, '批量拒绝访客')).get();
    expect(row).toBeTruthy();
    const id = row!.id;

    // 批量拒绝
    const batch = await app.request('/api/admin/comments/batch', {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ ids: [id], action: 'reject' }),
    });
    expect(batch.status).toBe(200);

    // 存储状态必须是 rejected（enum 合法值）
    const stored = ctx.db.select().from(comments).where(eq(comments.id, id)).get();
    expect(stored?.status).toBe('rejected');

    // 按状态过滤列表能查到
    const list = await app.request('/api/admin/comments?status=rejected', { headers });
    const listBody = await list.json();
    expect(listBody.data.some((c: { id: number }) => c.id === id)).toBe(true);
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

  it('魔数与声明类型不符时拒绝上传', async () => {
    const headers = authHeaders(token);
    // 声明 PNG，但内容头是 JPEG 魔数（FF D8 FF）
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00])], { type: 'image/png' }), 'fake.png');
    const res = await app.request('/api/admin/upload', {
      method: 'POST',
      headers,
      body: form,
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID');
  });

  it('拒绝上传 SVG（可携带脚本）', async () => {
    const headers = authHeaders(token);
    const form = new FormData();
    form.append('file', new Blob([`<svg xmlns="http://www.w3.org/2000/svg"></svg>`], { type: 'image/svg+xml' }), 'a.svg');
    const res = await app.request('/api/admin/upload', {
      method: 'POST',
      headers,
      body: form,
    });
    expect(res.status).toBe(400);
  });

  it('音频类型宽容处理（声明 audio/mpeg 但为 Ogg 魔数时仍放行）', async () => {
    const headers = authHeaders(token);
    const form = new FormData();
    // OggS 魔数 + 声明 audio/mpeg：跨音频子类视为宽容
    form.append('file', new Blob([new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00])], { type: 'audio/mpeg' }), 'a.mp3');
    const res = await app.request('/api/admin/upload', {
      method: 'POST',
      headers,
      body: form,
    });
    expect(res.status).toBe(201);
  });

  it('所有响应携带 nosniff 安全头', async () => {
    const headers = authHeaders(token);
    const res = await app.request('/api/admin/stats', { headers });
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    const pub = await app.request('/api/health');
    expect(pub.headers.get('x-content-type-options')).toBe('nosniff');
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

  it('TMDB API Key 掩码往返（写入/读取均不泄露明文）', async () => {
    const headers = authHeaders(token);
    const put = await app.request('/api/admin/settings', {
      method: 'PUT', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ tmdb_api_key: 'tmdb-secret-key-123' }),
    });
    expect(put.status).toBe(200);
    const putBody = await put.json();
    expect(putBody.data.tmdb_api_key).toBe('********'); // 写入响应即掩码

    const get = await app.request('/api/admin/settings', { headers });
    const getBody = await get.json();
    expect(getBody.data.tmdb_api_key).toBe('********');

    // 用掩码再 PUT，密钥应保留而非覆盖为空
    const put2 = await app.request('/api/admin/settings', {
      method: 'PUT', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ tmdb_api_key: '********' }),
    });
    expect(put2.status).toBe(200);
    const get2 = await app.request('/api/admin/settings', { headers });
    const get2Body = await get2.json();
    expect(get2Body.data.tmdb_api_key).toBe('********');
  });
});
