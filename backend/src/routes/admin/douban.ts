import { Hono } from 'hono';
import { getSetting } from '../../lib/settings';
import { syncDoubanMovies } from '../public/douban';
import type { Db } from '../../db';

// 后台手动同步：拉取豆瓣订阅源 + TMDB 海报，预热共享缓存
export function doubanAdminRoutes(ctx: Db) {
  const app = new Hono();

  app.post('/douban/sync', async (c) => {
    if (getSetting(ctx, 'douban_enabled') !== '1') {
      return c.json({ error: { code: 'INVALID', message: '请先开启豆瓣影音展示并填写用户 ID' } }, 400);
    }
    const uid = getSetting(ctx, 'douban_uid').trim();
    if (!uid) {
      return c.json({ error: { code: 'INVALID', message: '请先填写豆瓣用户 ID' } }, 400);
    }
    try {
      const movies = await syncDoubanMovies(uid, getSetting(ctx, 'tmdb_api_key').trim());
      return c.json({ data: { count: movies.length, movies } });
    } catch (e) {
      return c.json(
        { error: { code: 'FETCH_FAILED', message: e instanceof Error ? e.message : '同步失败' } },
        502,
      );
    }
  });

  return app;
}
