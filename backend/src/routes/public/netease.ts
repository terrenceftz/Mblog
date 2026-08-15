import { Hono } from 'hono';
import { getSetting } from '../../lib/settings';
import { getUserPlaylists, getPlaylistDetail, getSongUrl } from '../../lib/netease';
import type { Db } from '../../db';

// 电台（网易云）公开接口：cookie 从后台 settings 读取，永不下发前端。
// 歌单列表/详情不再内存缓存——用户改歌单后前台刷新需实时可见（网易云接口本身足够快）。

export function neteaseRoutes(ctx: Db) {
  const app = new Hono();

  // 账号收藏歌单列表
  app.get('/netease/playlists', async (c) => {
    const cookie = getSetting(ctx, 'netease_cookie');
    if (!cookie) return c.json({ error: { code: 'NOT_CONFIGURED', message: '网易云 Cookie 未配置，请到后台配置' } }, 400);
    const r = await getUserPlaylists(cookie);
    if (!r.ok) return c.json({ error: { code: 'NETEASE', message: r.message } }, r.status === 401 ? 401 : 502);
    return c.json({ data: { playlists: r.data } });
  });

  // 歌单详情（实时，新增收藏立即可见）
  app.get('/netease/playlist', async (c) => {
    const id = Number(c.req.query('id'));
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: { code: 'INVALID', message: '歌单 id 无效' } }, 400);
    const cookie = getSetting(ctx, 'netease_cookie');
    if (!cookie) return c.json({ error: { code: 'NOT_CONFIGURED', message: '网易云 Cookie 未配置，请到后台配置' } }, 400);
    const r = await getPlaylistDetail(cookie, id);
    if (!r.ok) return c.json({ error: { code: 'NETEASE', message: r.message } }, r.status === 401 ? 401 : 502);
    return c.json({ data: r.data });
  });

  // 单曲播放 URL（实时拉取，不过期缓存）
  app.get('/netease/song/url', async (c) => {
    const id = Number(c.req.query('id'));
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: { code: 'INVALID', message: '歌曲 id 无效' } }, 400);
    const cookie = getSetting(ctx, 'netease_cookie');
    if (!cookie) return c.json({ error: { code: 'NOT_CONFIGURED', message: '网易云 Cookie 未配置，请到后台配置' } }, 400);
    const r = await getSongUrl(cookie, id);
    if (!r.ok) return c.json({ error: { code: 'NETEASE', message: r.message } }, r.status === 401 ? 401 : 502);
    return c.json({ data: { url: r.data } });
  });

  return app;
}
