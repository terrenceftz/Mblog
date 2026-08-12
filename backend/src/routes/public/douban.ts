import { request as httpsRequest } from 'node:https';
import { Hono } from 'hono';
import { getSetting } from '../../lib/settings';
import type { Db } from '../../db';

export interface DoubanMovie {
  title: string;
  /** 豆瓣条目英文原片名（内部用于 TMDB 搜索） */
  altTitle?: string;
  /** 上映年份（从条目 intro 提取，用于 TMDB 消歧） */
  year?: string;
  url: string;
  cover: string;
  rating: number; // 1-5，0=未评分
  ratingText: string;
  date: string; // YYYY-MM-DD，空=未知
}

const TTL = 30 * 60 * 1000; // 豆瓣无官方 API，收藏页分页抓取 + 30 分钟缓存
// 共享缓存：公开接口与后台同步共用；测试通过 resetDoubanCache 隔离
const cache = new Map<string, { time: number; data: DoubanMovie[] }>();
// 后台刷新单飞集合：同 uid 同时只有一个同步在跑，避免并发请求重复抓取
const refreshing = new Set<string>();
// 在途刷新 Promise 表：测试用 flushDoubanRefresh 等待完成，避免未完成同步污染后续用例
const pending = new Map<string, Promise<void>>();

export function resetDoubanCache(): void {
  cache.clear();
  refreshing.clear();
  pending.clear();
}

/**
 * 后台刷新（stale-while-revalidate 的 revalidate 半场）：
 * 公开接口永不阻塞在外部同步上——有旧数据立即返回旧数据，无数据立即返回空，
 * 同步在后台进行，成功后由 syncDoubanMovies 覆写缓存；失败保留旧缓存。
 */
function refreshDouban(uid: string, tmdbKey: string): void {
  if (refreshing.has(uid)) return;
  refreshing.add(uid);
  const p = syncDoubanMovies(uid, tmdbKey)
    .catch(() => {
      // 刷新失败：保留旧缓存（syncDoubanMovies 只在成功时 cache.set）
    })
    .finally(() => {
      refreshing.delete(uid);
      pending.delete(uid);
    });
  pending.set(uid, p);
}

/** 仅测试用：等待所有后台刷新完成（避免未完成同步污染后续用例 / 触发真实网络） */
export async function flushDoubanRefresh(): Promise<void> {
  await Promise.all([...pending.values()]);
}

/** 仅测试用：把指定 uid 的缓存拨到已过期，模拟 TTL 失效 */
export function expireDoubanCache(uid: string): void {
  const hit = cache.get(uid);
  if (hit) hit.time -= TTL + 1;
}

const COLLECT_PAGE_SIZE = 15;
const MAX_ITEMS = 300; // 上限：最新 300 条（按时间倒序）

async function fetchCollectPage(uid: string, start: number): Promise<string> {
  const res = await fetch(
    `https://movie.douban.com/people/${encodeURIComponent(uid)}/collect?sort=time&start=${start}`,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!res.ok) throw new Error(`Douban collect ${res.status}`);
  return res.text();
}

// 抓取「看过」收藏页（分页）：包含全部电影与电视剧记录（movie.douban.com 不含读书/音乐）
export async function fetchDoubanMovies(uid: string): Promise<DoubanMovie[]> {
  const movies: DoubanMovie[] = [];
  for (let start = 0; start < MAX_ITEMS; start += COLLECT_PAGE_SIZE) {
    const html = await fetchCollectPage(uid, start);
    const chunks = html.split('<div class="item comment-item"').slice(1);
    if (chunks.length === 0) break;
    for (const chunk of chunks) {
      const title = /<em>(.*?)<\/em>/.exec(chunk)?.[1]?.trim() ?? '';
      const url = /<a href="(https:\/\/movie\.douban\.com\/subject\/\d+\/)"/.exec(chunk)?.[1] ?? '';
      // 英文/别名：em 之后最后一个 " / Xxx" 片段（如 "难哄(剧版) / The First Frost" → The First Frost）
      const afterEm = (chunk.match(/<\/em>([\s\S]*?)<\/a>/) ?? [])[1] ?? '';
      const segs = afterEm
        .split('/')
        .map((s) => s.replace(/<[^>]+>/g, '').trim())
        .filter(Boolean);
      const altTitle = segs[segs.length - 1] ?? '';
      const intro = /<li class="intro">([\s\S]*?)<\/li>/.exec(chunk)?.[1] ?? '';
      const year = /(\d{4})-\d{2}-\d{2}/.exec(intro)?.[1] ?? '';
      const cover = /<img[^>]+src="([^"]+)"/.exec(chunk)?.[1] ?? '';
      const ratingClass = /class="rating(\d)-t"/.exec(chunk)?.[1];
      const rating = ratingClass ? Number(ratingClass) : 0;
      const ratingText = ['', '很差', '较差', '还行', '推荐', '力荐'][rating] ?? '';
      const date = /<span class="date">([^<]+)<\/span>/.exec(chunk)?.[1]?.trim() ?? '';
      if (title && url) {
        movies.push({ title, altTitle, year, url, cover, rating, ratingText, date });
        if (movies.length >= MAX_ITEMS) return movies;
      }
    }
    // 页间小延迟，避免豆瓣限流
    if (chunks.length >= COLLECT_PAGE_SIZE) await new Promise((r) => setTimeout(r, 300));
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

let tmdbDnsPoisoned = false; // 当前进程内域名不可达（DNS 污染）则后续跳过域名尝试，直接走 IP

async function tmdbFetch(path: string): Promise<TmdbRes | null> {
  if (!tmdbDnsPoisoned) {
    try {
      const res = await fetch(`https://${TMDB_HOST}${path}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(3000), // 正常网络 <1s 返回；被污染网络 3s 内判死
      });
      if (res.ok) return { ok: true, json: () => res.json() };
    } catch {
      tmdbDnsPoisoned = true;
    }
  }
  // 原有 IP 兜底逻辑保持不变
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

function norm(s: string): string {
  return s.toLowerCase().replace(/[\s'’"·–—-]+/g, '');
}

// 严格匹配 TMDB：中文名精确命中（title/original_title 即中文）→ 英文别名精确命中；
// 两者都要求年份 ±1 内；匹配不到回退豆瓣封面，避免张冠李戴
async function tmdbPoster(apiKey: string, title: string, altTitle: string, year: string, fallback: string): Promise<string> {
  const queries = [title, altTitle].filter(Boolean);
  for (const q of queries) {
    const path = `/3/search/movie?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(q)}&language=zh-CN&include_adult=false`;
    const res = await tmdbFetch(path);
    if (!res || !res.ok) continue;
    try {
      const body = (await res.json()) as {
        results?: { title?: string; original_title?: string; release_date?: string; poster_path?: string | null }[];
      };
      for (const r of body.results ?? []) {
        const nameMatch = norm(r.title ?? '') === norm(q) || norm(r.original_title ?? '') === norm(q);
        if (!nameMatch) continue;
        const rYear = (r.release_date ?? '').slice(0, 4);
        if (year && (!rYear || Number(rYear) !== Number(year))) continue;
        if (r.poster_path) return `https://image.tmdb.org/t/p/w500${r.poster_path}`;
      }
    } catch {
      // 解析失败，尝试下一个查询
    }
  }
  return fallback;
}

// TMDB 搜索批量并行（每批 6 个，兼顾速率限制）；失败项回退豆瓣封面
export async function enrichWithTmdb(movies: DoubanMovie[], apiKey: string): Promise<DoubanMovie[]> {
  if (!apiKey) return movies;
  const out: DoubanMovie[] = new Array(movies.length);
  const BATCH = 6;
  for (let i = 0; i < movies.length; i += BATCH) {
    const batch = movies.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (m) => ({ m, cover: await tmdbPoster(apiKey, m.title, m.altTitle ?? '', m.year ?? '', m.cover) })),
    );
    for (const { m, cover } of results) out[i + batch.indexOf(m)] = { ...m, cover };
  }
  return out;
}

// 豆瓣封面经代理输出（绕过防盗链）；TMDB 海报直连
function proxyCover(url: string): string {
  return /^https:\/\/img\d*\.doubanio\.com\//.test(url) ? `/api/cover?url=${encodeURIComponent(url)}` : url;
}

// 全量拉取（豆瓣 + TMDB 海报）并写入共享缓存
export async function syncDoubanMovies(uid: string, tmdbKey: string): Promise<DoubanMovie[]> {
  const movies = (await enrichWithTmdb(await fetchDoubanMovies(uid), tmdbKey)).map((m) => ({
    ...m,
    cover: proxyCover(m.cover),
  }));
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
    const stale = !hit || Date.now() - hit.time >= TTL;
    if (stale) {
      // 永不阻塞：后台刷新（单飞），立即返回已有数据（无则空）
      refreshDouban(uid, getSetting(ctx, 'tmdb_api_key').trim());
    }
    return c.json({
      data: {
        enabled: true,
        uid,
        movies: hit?.data ?? [],
        ...(stale ? { stale: true } : {}),
        ...(hit ? {} : { syncing: true }),
      },
    });
  });

  return app;
}
