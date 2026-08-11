import { request as httpsRequest } from 'node:https';
import { Hono } from 'hono';
import { XMLParser } from 'fast-xml-parser';
import { getSetting } from '../../lib/settings';
import type { Db } from '../../db';

export interface DoubanMovie {
  title: string;
  /** 豆瓣条目英文原片名（内部用于 TMDB 搜索） */
  altTitle?: string;
  url: string;
  cover: string;
  rating: number; // 1-5，0=未评分
  ratingText: string;
  date: string; // YYYY-MM-DD，空=未知
}

const TTL = 30 * 60 * 1000; // 豆瓣无官方 API，订阅源拉取 + 30 分钟缓存
const RATING_MAP: Record<string, number> = { 力荐: 5, 推荐: 4, 还行: 3, 较差: 2, 很差: 1 };
// 共享缓存：公开接口与后台同步共用；测试通过 resetDoubanCache 隔离
const cache = new Map<string, { time: number; data: DoubanMovie[] }>();

export function resetDoubanCache(): void {
  cache.clear();
}

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
    const altTitle = (/title="([^"]+)"/.exec(desc)?.[1] ?? '')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .trim();
    const ratingMatch = /推荐:\s*([^<\s]+)/.exec(desc);
    const ratingText = ratingMatch?.[1] ?? '';
    const rating = RATING_MAP[ratingText] ?? 0;
    const pub = it.pubDate ? new Date(String(it.pubDate)) : null;
    const date = pub && !Number.isNaN(pub.getTime()) ? pub.toISOString().slice(0, 10) : '';
    const cleanTitle = title.replace(/^看过/, '').trim();
    if (cleanTitle) movies.push({ title: cleanTitle, altTitle, url: link, cover, rating, ratingText, date });
  }
  return movies;
}

// TMDB API 在部分网络下 DNS 被污染，先走正常域名，失败时直连 CloudFront IP（带 SNI）
const TMDB_HOST = 'api.themoviedb.org';
const TMDB_FALLBACK_IPS = ['13.32.36.72', '13.33.29.220', '13.226.240.46'];
const TMDB_TIMEOUT = 8000;

interface TmdbRes {
  ok: boolean;
  json(): Promise<unknown>;
}

async function tmdbFetch(path: string): Promise<TmdbRes | null> {
  try {
    const res = await fetch(`https://${TMDB_HOST}${path}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TMDB_TIMEOUT),
    });
    if (res.ok) return { ok: true, json: () => res.json() };
  } catch {
    // 正常域名不可达（DNS 污染/网络阻断），走 IP 兜底
  }
  for (const ip of TMDB_FALLBACK_IPS) {
    try {
      const res = await new Promise<TmdbRes | null>((resolve, reject) => {
        const req = httpsRequest(
          {
            host: ip,
            servername: TMDB_HOST,
            port: 443,
            path,
            headers: { Host: TMDB_HOST, Accept: 'application/json' },
          },
          (r) => {
            const chunks: Buffer[] = [];
            r.on('data', (c) => chunks.push(Buffer.from(c)));
            r.on('end', () => {
              resolve({
                ok: (r.statusCode ?? 0) >= 200 && (r.statusCode ?? 0) < 300,
                json: async () => JSON.parse(Buffer.concat(chunks).toString('utf-8')),
              });
            });
          },
        );
        req.setTimeout(TMDB_TIMEOUT, () => req.destroy(new Error('timeout')));
        req.on('error', reject);
        req.end();
      });
      if (res && res.ok) return res;
    } catch {
      // 尝试下一个 IP
    }
  }
  return null;
}

// TMDB 搜索单部电影海报；失败/无结果回退豆瓣封面
async function tmdbPoster(apiKey: string, query: string, fallback: string): Promise<string> {
  const path = `/3/search/movie?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(query)}&language=zh-CN&include_adult=false`;
  const res = await tmdbFetch(path);
  if (!res || !res.ok) return fallback;
  try {
    const body = (await res.json()) as { results?: { poster_path?: string | null }[] };
    const posterPath = body.results?.find((r) => r.poster_path)?.poster_path;
    return posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : fallback;
  } catch {
    return fallback;
  }
}

// 为电影列表批量补充 TMDB 海报（无 key 时原样返回）
export async function enrichWithTmdb(movies: DoubanMovie[], apiKey: string): Promise<DoubanMovie[]> {
  if (!apiKey) return movies;
  const out: DoubanMovie[] = [];
  for (const m of movies) {
    const query = m.altTitle || m.title;
    out.push({ ...m, cover: await tmdbPoster(apiKey, query, m.cover) });
  }
  return out;
}

// 全量拉取（豆瓣 + TMDB 海报）并写入共享缓存
export async function syncDoubanMovies(uid: string, tmdbKey: string): Promise<DoubanMovie[]> {
  const movies = await enrichWithTmdb(await fetchDoubanMovies(uid), tmdbKey);
  cache.set(uid, { time: Date.now(), data: movies });
  return movies;
}

export function doubanRoutes(ctx: Db) {
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
      const movies = await syncDoubanMovies(uid, getSetting(ctx, 'tmdb_api_key').trim());
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
