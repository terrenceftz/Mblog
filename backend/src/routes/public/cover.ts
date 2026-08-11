import { Hono } from 'hono';

const TTL = 24 * 60 * 60 * 1000; // 图片缓存 1 天
const MAX_CACHE = 200;
const cache = new Map<string, { time: number; body: Uint8Array<ArrayBuffer>; type: string }>();

// 豆瓣封面代理：带 Referer 绕过防盗链（418），服务端拉取 + 缓存
export function coverRoutes() {
  const app = new Hono();

  app.get('/cover', async (c) => {
    const url = c.req.query('url') ?? '';
    // 仅允许豆瓣图片域名，防止 SSRF
    if (!/^https:\/\/img\d*\.doubanio\.com\//.test(url)) {
      return c.json({ error: { code: 'INVALID', message: '仅支持豆瓣图片地址' } }, 400);
    }
    const hit = cache.get(url);
    if (hit && Date.now() - hit.time < TTL) {
      return c.body(hit.body, 200, { 'Content-Type': hit.type, 'Cache-Control': 'public, max-age=86400' });
    }
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MBLOG/1.0',
          Referer: 'https://movie.douban.com/',
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return c.json({ error: { code: 'FETCH_FAILED', message: `拉取失败 ${res.status}` } }, 502);
      const body = new Uint8Array(await res.arrayBuffer());
      const type = res.headers.get('content-type') ?? 'image/jpeg';
      if (cache.size >= MAX_CACHE) cache.clear();
      cache.set(url, { time: Date.now(), body, type });
      return c.body(body, 200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' });
    } catch {
      return c.json({ error: { code: 'FETCH_FAILED', message: '图片拉取失败' } }, 502);
    }
  });

  return app;
}
