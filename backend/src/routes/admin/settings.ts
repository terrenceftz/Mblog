import { Hono } from 'hono';
import { getSettings, setSetting, DEFAULT_SETTINGS } from '../../lib/settings';
import type { Db } from '../../db';

// 密文掩码约定：GET 返回占位符，PUT 收到占位符时保留原值
const MASK = '********';
const MASKED_KEYS = new Set(['cos_secret_key', 'tmdb_api_key', 'turnstile_secret_key', 'netease_cookie', 'smtp_pass', 'totp_secret']);
// TOTP 状态只能通过 /admin/totp/* 专用路由变更（enable 需当前验证码、disable 需当前码），
// 通用设置接口一律拒写，避免持有 JWT 即绕过两步验证防线
const SETTINGS_WRITE_FORBIDDEN = new Set(['totp_enabled', 'totp_secret']);

function maskSecrets(data: Record<string, string>): Record<string, string> {
  for (const k of MASKED_KEYS) if (data[k]) data[k] = MASK;
  return data;
}

export function settingsAdminRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/settings', (c) => {
    const data = getSettings(ctx, Object.keys(DEFAULT_SETTINGS));
    return c.json({ data: maskSecrets(data) });
  });

  app.put('/settings', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return c.json({ error: { code: 'INVALID', message: '参数错误' } }, 400);
    }
    const allowed = new Set(Object.keys(DEFAULT_SETTINGS));
    for (const [key, value] of Object.entries(body)) {
      if (!allowed.has(key) || typeof value !== 'string') continue;
      if (SETTINGS_WRITE_FORBIDDEN.has(key)) continue;
      // 掩码占位符 → 保留已存密钥
      if (MASKED_KEYS.has(key) && value === MASK) continue;
      setSetting(ctx, key, value);
    }
    const data = getSettings(ctx, Object.keys(DEFAULT_SETTINGS));
    return c.json({ data: maskSecrets(data) });
  });

  return app;
}
