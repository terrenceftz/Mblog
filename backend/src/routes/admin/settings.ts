import { Hono } from 'hono';
import { getSettings, setSetting, DEFAULT_SETTINGS } from '../../lib/settings';
import type { Db } from '../../db';

// 密文掩码约定：GET 返回占位符，PUT 收到占位符时保留原值
const MASK = '********';

export function settingsAdminRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/settings', (c) => {
    const keys = Object.keys(DEFAULT_SETTINGS);
    const data = getSettings(ctx, keys);
    if (data.cos_secret_key) data.cos_secret_key = MASK;
    if (data.tmdb_api_key) data.tmdb_api_key = MASK;
    return c.json({ data });
  });

  app.put('/settings', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return c.json({ error: { code: 'INVALID', message: '参数错误' } }, 400);
    }
    const allowed = new Set(Object.keys(DEFAULT_SETTINGS));
    for (const [key, value] of Object.entries(body)) {
      if (!allowed.has(key) || typeof value !== 'string') continue;
      // 掩码占位符 → 保留已存密钥
      if ((key === 'cos_secret_key' || key === 'tmdb_api_key') && value === MASK) continue;
      setSetting(ctx, key, value);
    }
    const data = getSettings(ctx, Object.keys(DEFAULT_SETTINGS));
    if (data.cos_secret_key) data.cos_secret_key = MASK;
    if (data.tmdb_api_key) data.tmdb_api_key = MASK;
    return c.json({ data });
  });

  return app;
}
