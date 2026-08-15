import { Hono } from 'hono';
import { getSetting } from '../../lib/settings';
import { getUserPlaylists } from '../../lib/netease';
import type { Db } from '../../db';

// 电台（网易云）后台接口：供站点设置页「刷新收藏歌单」使用（cookie 已在库中）
export function neteaseAdminRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/netease/playlists', async (c) => {
    const cookie = getSetting(ctx, 'netease_cookie');
    if (!cookie) return c.json({ error: { code: 'NOT_CONFIGURED', message: '请先保存网易云 Cookie' } }, 400);
    const r = await getUserPlaylists(cookie);
    if (!r.ok) return c.json({ error: { code: 'NETEASE', message: r.message } }, r.status === 401 ? 401 : 502);
    return c.json({ data: { playlists: r.data } });
  });

  return app;
}
