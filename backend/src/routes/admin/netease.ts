import { Hono } from 'hono';
import { getSetting, setSetting } from '../../lib/settings';
import { getUserPlaylists, sendSmsCode, loginByPhone } from '../../lib/netease';
import type { Db } from '../../db';

// 电台（网易云）后台接口：供站点设置页「刷新收藏歌单」与「验证码登录」使用
export function neteaseAdminRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/netease/playlists', async (c) => {
    const cookie = getSetting(ctx, 'netease_cookie');
    if (!cookie) return c.json({ error: { code: 'NOT_CONFIGURED', message: '请先登录网易云（配置 Cookie 或验证码登录）' } }, 400);
    const r = await getUserPlaylists(cookie);
    if (!r.ok) return c.json({ error: { code: 'NETEASE', message: r.message } }, r.status === 401 ? 401 : 502);
    return c.json({ data: { playlists: r.data } });
  });

  // 发送短信验证码
  app.post('/netease/sendcode', async (c) => {
    const body = await c.req.json().catch(() => null);
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
    if (!/^\d{11}$/.test(phone)) return c.json({ error: { code: 'INVALID', message: '手机号格式不正确' } }, 400);
    const r = await sendSmsCode('', phone);
    if (!r.ok) return c.json({ error: { code: 'NETEASE', message: r.message } }, 502);
    return c.json({ data: { ok: true } });
  });

  // 手机号 + 验证码登录 → 保存 Cookie
  app.post('/netease/login', async (c) => {
    const body = await c.req.json().catch(() => null);
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    if (!/^\d{11}$/.test(phone)) return c.json({ error: { code: 'INVALID', message: '手机号格式不正确' } }, 400);
    if (!/^\d{4,6}$/.test(code)) return c.json({ error: { code: 'INVALID', message: '验证码格式不正确' } }, 400);
    const r = await loginByPhone(phone, code);
    if (!r.ok) return c.json({ error: { code: 'NETEASE', message: r.message } }, 502);
    setSetting(ctx, 'netease_cookie', r.data);
    return c.json({ data: { ok: true, message: '登录成功，Cookie 已保存' } });
  });

  return app;
}
