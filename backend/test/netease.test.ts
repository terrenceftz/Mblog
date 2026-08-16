import { describe, it, expect } from 'vitest';
import { makeTestApp } from './helpers';

// 网易云接口测试：不触网（weapi 请求外部）。仅覆盖路由校验层——
// 非法 id / 未配置 Cookie，均不发起真实网络请求。
describe('netease 公开接口（路由校验层）', () => {
  const { app } = makeTestApp();

  it('song/url 非法 id 返回 400', async () => {
    const res = await app.request('/api/netease/song/url?id=abc');
    expect(res.status).toBe(400);
  });

  it('lyric 非法 id 返回 400', async () => {
    const res = await app.request('/api/netease/lyric?id=abc');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID');
  });

  it('lyric 未配置 Cookie 返回 400 NOT_CONFIGURED', async () => {
    const res = await app.request('/api/netease/lyric?id=123456');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_CONFIGURED');
  });
});
