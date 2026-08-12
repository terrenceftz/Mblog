# 豆瓣 TMDB 海报 + 后台同步按钮 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** ① 豆瓣影音改用 TMDB 海报（doubanio 封面被防盗链拦截返回 418）；② 后台加「立即同步」按钮预热缓存，避免前台冷访问卡顿。

**Architecture:** 缓存从路由闭包改为模块级共享 Map（测试用 `resetDoubanCache()` 隔离，复用 resetRateLimit 模式）；解析豆瓣订阅源时提取英文原片名，调用 TMDB search 取 `poster_path` 生成海报，失败回退豆瓣封面；新增 `POST /admin/douban/sync` 后台同步接口，与公开 `/douban` 共用缓存。

**设计文档:** `docs/superpowers/specs/2026-08-11-douban-movies-design.md`

---

## 任务概览

1. 后端：共享缓存重构 + TMDB 海报 + `/admin/douban/sync` + 测试
2. 后台：TMDB Key 字段 + 立即同步按钮
3. 端到端验证：预填 TMDB Key、真实同步、/douban 展示 TMDB 海报

---

### Task 1: 后端 TMDB + 同步

**Files:**
- Rewrite: `backend/src/routes/public/douban.ts`
- Create: `backend/src/routes/admin/douban.ts`
- Modify: `backend/src/routes/admin.ts`
- Modify: `backend/src/lib/settings.ts`
- Modify: `backend/test/setup.ts`
- Modify: `backend/test/douban.test.ts`

**Step 1: 设置键**

`backend/src/lib/settings.ts` 末尾追加 `tmdb_api_key: '',`（注释 `// TMDB API Key（豆瓣海报图源）`）。

**Step 2: 重写 douban.ts**

用以下内容整体替换 `backend/src/routes/public/douban.ts`：

```ts
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

// TMDB 搜索单部电影海报；失败/无结果回退豆瓣封面
async function tmdbPoster(apiKey: string, query: string, fallback: string): Promise<string> {
  try {
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(query)}&language=zh-CN&include_adult=false`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return fallback;
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
```

**Step 3: 后台同步路由**

创建 `backend/src/routes/admin/douban.ts`：

```ts
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
```

修改 `backend/src/routes/admin.ts`：加 `import { doubanAdminRoutes } from './admin/douban';` 并在 `app.route('/', settingsAdminRoutes(ctx));` 后加 `app.route('/', doubanAdminRoutes(ctx));`。

**Step 4: 测试隔离**

修改 `backend/test/setup.ts`：

```ts
import { beforeEach } from 'vitest';
import { resetRateLimit } from '../src/middleware/rateLimit';
import { resetDoubanCache } from '../src/routes/public/douban';

beforeEach(() => {
  resetRateLimit();
  resetDoubanCache();
});
```

**Step 5: 更新测试**

在 `backend/test/douban.test.ts` 追加：

```ts
import { syncDoubanMovies } from '../src/routes/public/douban';

describe('TMDB 海报', () => {
  it('有 key 时逐部搜索 TMDB 并替换封面', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => SAMPLE_FEED })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ poster_path: '/a.jpg' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ poster_path: null }] }) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const movies = await syncDoubanMovies('1017197', 'testkey');
      expect(movies).toHaveLength(2);
      expect(movies[0].cover).toBe('https://image.tmdb.org/t/p/w500/a.jpg');
      expect(movies[1].cover).toBe(''); // 无 poster_path → 回退原封面（示例 feed 封面为空）
      expect(fetchMock).toHaveBeenCalledTimes(3); // feed + 2 部电影
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('无 key 时不调用 TMDB，保留原封面', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => SAMPLE_FEED });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const movies = await syncDoubanMovies('1017197', '');
      expect(movies[0].cover).toContain('doubanio');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('后台同步接口 /api/admin/douban/sync', () => {
  it('同步成功返回条数并预热缓存', async () => {
    const { app } = makeTestApp();
    await enableDouban(app);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => SAMPLE_FEED })
      .mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const token = await loginAsAdmin(app);
      const res = await app.request('/api/admin/douban/sync', { method: 'POST', headers: authHeaders(token) });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { count: number } };
      expect(body.data.count).toBe(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('未开启时返回 400', async () => {
    const { app } = makeTestApp();
    const token = await loginAsAdmin(app);
    const res = await app.request('/api/admin/douban/sync', { method: 'POST', headers: authHeaders(token) });
    expect(res.status).toBe(400);
  });
});
```

注意：原有用例（缓存 TTL、错误回退等）依赖「tmdb_api_key 为空时不调用 TMDB」——`enableDouban` 只设置 douban 字段，不设置 tmdb_api_key，故保持 1 次 fetch，原断言不变。

**Step 6: 运行测试**

Run: `cd E:/zcodework/MBLOG/backend && npx vitest run test/douban.test.ts` — expect 9 tests PASS（原 5 + 新增 4）。
随后 `npx vitest run`（全量）与 `npx tsc --noEmit` 均通过。

**Step 7: 提交**

```bash
git add backend/src/routes/public/douban.ts backend/src/routes/admin/douban.ts backend/src/routes/admin.ts backend/src/lib/settings.ts backend/test/setup.ts backend/test/douban.test.ts
git commit -m "feat: 豆瓣影音接入 TMDB 海报 + 后台同步接口预热缓存"
```

---

### Task 2: 后台 TMDB Key + 同步按钮

**Files:**
- Modify: `admin/src/views/SettingsPage.vue`
- Modify: `admin/src/api/admin.ts`

**Step 1: admin api 新增同步函数**

`admin/src/api/admin.ts` 追加：

```ts
export function adminSyncDouban(): Promise<{ count: number }> {
  return request('/admin/douban/sync', { method: 'POST' });
}
```

**Step 2: SettingsPage 脚本**

`admin/src/views/SettingsPage.vue` 的 `<script setup>` 中，`error` ref 之后追加：

```ts
const syncing = ref(false);
const syncMsg = ref('');
const syncError = ref('');
async function syncDouban() {
  syncing.value = true;
  syncMsg.value = '';
  syncError.value = '';
  try {
    const r = await adminSyncDouban();
    syncMsg.value = `已同步 ${r.count} 部，缓存已预热`;
  } catch (e) {
    syncError.value = e instanceof Error ? e.message : '同步失败';
  } finally {
    syncing.value = false;
  }
}
```

并在顶部 import 中把 `adminSyncDouban` 加入（`import { adminGetSettings, adminPutSettings, adminSyncDouban } from '../api/admin';`）。

**Step 3: 豆瓣 fieldset 扩展**

在「豆瓣影音展示」fieldset 中，「豆瓣用户 ID」label 之后、`menu-tip` 之前插入：

```html
        <label>TMDB API Key（海报图源）
          <input v-model="form.tmdb_api_key" placeholder="themoviedb.org 申请的 key" />
        </label>
        <div class="sync-row">
          <button type="button" class="btn" :disabled="syncing" @click="syncDouban">
            {{ syncing ? '同步中…' : '立即同步豆瓣数据' }}
          </button>
          <span v-if="syncMsg" class="saved">{{ syncMsg }}</span>
          <span v-if="syncError" class="error">{{ syncError }}</span>
        </div>
```

并把该 fieldset 的 menu-tip 文案改为：

```html
        <p class="menu-tip">同步会拉取「看过」的电影与 TMDB 海报并预热缓存，避免前台首次访问卡顿。</p>
```

**Step 4: 样式**

`admin/src/views/SettingsPage.vue` 的 scoped 样式追加：

```css
.sync-row { display: flex; align-items: center; gap: 12px; }
```

**Step 5: 验证**

Run: `cd E:/zcodework/MBLOG/admin && npm run typecheck` — expect 0 errors。

**Step 6: 提交**

```bash
git add admin/src/views/SettingsPage.vue admin/src/api/admin.ts
git commit -m "feat: 后台设置页 TMDB Key 配置 + 豆瓣立即同步按钮"
```

---

### Task 3: 端到端验证

**Files:** 无新增

**Step 1: 配置真实数据**

通过 admin API（python urllib，登录 admin/admin123）设置：
- `douban_enabled: '1'`、`douban_uid: '1017197'`
- `tmdb_api_key: '<REDACTED>'`（用户提供的 key，已在 .env 中配置，勿提交明文）

**Step 2: 同步 + 验证**

- `POST /api/admin/douban/sync` → 返回 count
- `GET /api/douban` → movies 的 cover 应为 `https://image.tmdb.org/t/p/w500/...`
- `curl http://localhost:4321/douban` → 页面展示 TMDB 海报
- 浏览器确认双主题正常

**Step 3: 收尾**

- 全量测试 `cd E:/zcodework/MBLOG/backend && npx vitest run`
- `git status` 干净；如无未提交改动则无需额外提交
- 配置保留（douban 已启用 + 用户 key 已填入），供用户直接使用
