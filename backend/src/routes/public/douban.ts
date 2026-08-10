import { Hono } from 'hono';
import { XMLParser } from 'fast-xml-parser';
import { getSetting } from '../../lib/settings';
import type { Db } from '../../db';

export interface DoubanMovie {
  title: string;
  url: string;
  cover: string;
  rating: number; // 1-5，0=未评分
  ratingText: string;
  date: string; // YYYY-MM-DD，空=未知
}

const TTL = 30 * 60 * 1000; // 豆瓣无官方 API，订阅源拉取 + 30 分钟缓存
const RATING_MAP: Record<string, number> = { 力荐: 5, 推荐: 4, 还行: 3, 较差: 2, 很差: 1 };

// 拉取并解析豆瓣订阅源：仅保留「看过」的电影
export async function fetchDoubanMovies(uid: string): Promise<DoubanMovie[]> {
  const res = await fetch(`https://www.douban.com/feed/people/${encodeURIComponent(uid)}/interests`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MBLOG/1.0',
      Accept: 'application/rss+xml',
    },
  });
  if (!res.ok) throw new Error(`Douban feed ${res.status}`);
  const xml = await res.text();
  const doc = new XMLParser({ ignoreAttributes: false }).parse(xml) as {
    rss?: { channel?: { item?: unknown } };
  };
  const items = doc?.rss?.channel?.item;
  const list = Array.isArray(items) ? items : items ? [items] : [];
  const movies: DoubanMovie[] = [];
  for (const raw of list) {
    const it = raw as { title?: string; link?: string; description?: string; pubDate?: string };
    const title = String(it.title ?? '');
    const link = String(it.link ?? '');
    if (!link.includes('movie.douban.com')) continue; // 仅电影
    if (!title.startsWith('看过')) continue; // 仅「看过」
    const desc = String(it.description ?? '');
    const cover = /src="([^"]+)"/.exec(desc)?.[1] ?? '';
    const ratingMatch = /推荐:\s*([^<\s]+)/.exec(desc);
    const ratingText = ratingMatch?.[1] ?? '';
    const rating = RATING_MAP[ratingText] ?? 0;
    const pub = it.pubDate ? new Date(String(it.pubDate)) : null;
    const date = pub && !Number.isNaN(pub.getTime()) ? pub.toISOString().slice(0, 10) : '';
    const cleanTitle = title.replace(/^看过/, '').trim();
    if (cleanTitle) movies.push({ title: cleanTitle, url: link, cover, rating, ratingText, date });
  }
  return movies;
}

export function doubanRoutes(ctx: Db) {
  // 缓存按 app 隔离，键为用户 ID
  const cache = new Map<string, { time: number; data: DoubanMovie[] }>();

  const app = new Hono();

  app.get('/douban', async (c) => {
    if (getSetting(ctx, 'douban_enabled') !== '1') {
      return c.json({ data: { enabled: false, movies: [] } });
    }
    const uid = getSetting(ctx, 'douban_uid').trim();
    if (!uid) {
      return c.json({ data: { enabled: false, movies: [] } });
    }
    const hit = cache.get(uid);
    if (hit && Date.now() - hit.time < TTL) {
      return c.json({ data: { enabled: true, uid, movies: hit.data } });
    }
    try {
      const movies = await fetchDoubanMovies(uid);
      cache.set(uid, { time: Date.now(), data: movies });
      return c.json({ data: { enabled: true, uid, movies } });
    } catch {
      if (hit) {
        return c.json({ data: { enabled: true, uid, movies: hit.data, stale: true } });
      }
      return c.json({ data: { enabled: true, uid, movies: [], error: '豆瓣数据拉取失败，请稍后重试' } });
    }
  });

  return app;
}
