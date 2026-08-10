# 豆瓣影音展示 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 前台新增「影音」页展示豆瓣「看过」电影（封面/标题/星级/日期），后台配置豆瓣 UID。

**Architecture:** 后端 `/api/douban` 拉取豆瓣订阅源 RSS → fast-xml-parser 解析 → 过滤电影+看过 → 30 分钟缓存（复用 GitHub 模式）；前台 `/douban` 页双主题展示；后台设置页配置。

**设计文档:** `docs/superpowers/specs/2026-08-11-douban-movies-design.md`

---

## 任务概览

1. 后端：fast-xml-parser 依赖 + 设置键 + `/api/douban` 接口 + 测试
2. 前台：api 类型扩展 + `/douban` 展示页 + 双主题样式
3. 后台：设置页豆瓣 fieldset
4. 端到端验证 + 提交

---

### Task 1: 后端豆瓣接口

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/src/lib/settings.ts`
- Create: `backend/src/routes/public/douban.ts`
- Modify: `backend/src/routes/public.ts`
- Create: `backend/test/douban.test.ts`

**Step 1: 安装依赖**

Run: `cd E:/zcodework/MBLOG/backend && npm install fast-xml-parser`
Expected: 安装成功（package.json 出现 `"fast-xml-parser": "^4.x"`）。

**Step 2: 设置键**

修改 `backend/src/lib/settings.ts`：
- `nav_menu` 默认数组中加入 `{ label: '影音', url: '/douban' }`（放在 项目 之后、RSS 之前）。
- 末尾追加：

```ts
  // 豆瓣影音展示
  douban_enabled: '0',
  douban_uid: '',
```

**Step 3: 创建 douban 路由**

创建 `backend/src/routes/public/douban.ts`：

```ts
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
    const ratingMatch = /推荐:\s*(\S+)/.exec(desc);
    const ratingText = ratingMatch?.[1] ?? '';
    const rating = RATING_MAP[ratingText] ?? 0;
    const pub = it.pubDate ? new Date(String(it.pubDate)) : null;
    const date =
      pub && !Number.isNaN(pub.getTime())
        ? `${pub.getFullYear()}-${String(pub.getMonth() + 1).padStart(2, '0')}-${String(pub.getDate()).padStart(2, '0')}`
        : '';
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
```

修改 `backend/src/routes/public.ts`：加 import `import { doubanRoutes } from './public/douban';`，并在挂载行 `app.route('/', githubRoutes(ctx));` 后加 `app.route('/', doubanRoutes(ctx));`。

**Step 4: 编写测试（TDD）**

创建 `backend/test/douban.test.ts`：

```ts
import { describe, it, expect, vi } from 'vitest';
import { makeTestApp, loginAsAdmin, authHeaders } from './helpers';
import { fetchDoubanMovies } from '../src/routes/public/douban';

const SAMPLE_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>测试 的收藏</title>
  <item>
    <title>看过辛德勒的名单</title>
    <link>https://movie.douban.com/subject/1295124/</link>
    <description><![CDATA[
    <table><tr>
    <td width="80px"><a href="https://movie.douban.com/subject/1295124/" title="Schindler's List">
    <img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p492406163.jpg" alt="Schindler's List"></a></td>
    <td><p>推荐: 力荐</p></td></tr></table>
    ]]></description>
    <pubDate>Mon, 29 Aug 2005 00:19:48 GMT</pubDate>
  </item>
  <item>
    <title>看过星际穿越</title>
    <link>https://movie.douban.com/subject/1889243/</link>
    <description><![CDATA[<p>推荐: 推荐</p>]]></description>
    <pubDate>Tue, 30 Aug 2005 00:00:00 GMT</pubDate>
  </item>
  <item>
    <title>想看沙丘</title>
    <link>https://movie.douban.com/subject/26891333/</link>
    <description><![CDATA[]]></description>
    <pubDate>Wed, 31 Aug 2005 00:00:00 GMT</pubDate>
  </item>
  <item>
    <title>读过百年孤独</title>
    <link>https://book.douban.com/subject/1008145/</link>
    <description><![CDATA[<p>推荐: 还行</p>]]></description>
    <pubDate>Thu, 01 Sep 2005 00:00:00 GMT</pubDate>
  </item>
</channel>
</rss>`;

describe('fetchDoubanMovies', () => {
  it('仅保留电影 + 看过，映射评分与日期，封面解析', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => SAMPLE_FEED });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const movies = await fetchDoubanMovies('1017197');
      expect(movies).toHaveLength(2);
      expect(movies[0]).toEqual({
        title: '辛德勒的名单',
        url: 'https://movie.douban.com/subject/1295124/',
        cover: 'https://img3.doubanio.com/view/photo/s_ratio_poster/public/p492406163.jpg',
        rating: 5,
        ratingText: '力荐',
        date: '2005-08-29',
      });
      expect(movies[1].rating).toBe(4);
      expect(movies[1].ratingText).toBe('推荐');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('拉取非 200 抛错', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);
    try {
      await expect(fetchDoubanMovies('x')).rejects.toThrow('Douban feed 403');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('豆瓣接口 /api/douban', () => {
  async function enableDouban(app: ReturnType<typeof makeTestApp>['app'], uid = '1017197') {
    const token = await loginAsAdmin(app);
    const put = await app.request('/api/admin/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify({ douban_enabled: '1', douban_uid: uid }),
    });
    expect(put.status).toBe(200);
  }

  it('未开启时返回 enabled:false', async () => {
    const { app } = makeTestApp();
    const res = await app.request('/api/douban');
    const body = (await res.json()) as { data: { enabled: boolean } };
    expect(body.data.enabled).toBe(false);
  });

  it('拉取成功返回电影列表，TTL 内缓存不重复请求', async () => {
    const { app } = makeTestApp();
    await enableDouban(app);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => SAMPLE_FEED });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res1 = await app.request('/api/douban');
      const body1 = (await res1.json()) as { data: { enabled: boolean; movies: { title: string }[] } };
      expect(body1.data.enabled).toBe(true);
      expect(body1.data.movies.map((m) => m.title)).toEqual(['辛德勒的名单', '星际穿越']);
      await app.request('/api/douban');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('拉取失败返回 error 提示', async () => {
    const { app } = makeTestApp();
    await enableDouban(app);
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res = await app.request('/api/douban');
      const body = (await res.json()) as { data: { error: string; movies: unknown[] } };
      expect(body.data.error).toBeTruthy();
      expect(body.data.movies).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
```

**Step 5: 运行测试**

Run: `cd E:/zcodework/MBLOG/backend && npx vitest run test/douban.test.ts`
Expected: 全部 PASS（5 个用例）。随后 `npx vitest run`（全量）与 `npx tsc --noEmit` 均通过。

**Step 6: 提交**

```bash
git add backend/package.json backend/package-lock.json backend/src/lib/settings.ts backend/src/routes/public/douban.ts backend/src/routes/public.ts backend/test/douban.test.ts
git commit -m "feat: 豆瓣影音接口（订阅源拉取+解析+过滤+缓存）"
```

---

### Task 2: 前台豆瓣展示页

**Files:**
- Modify: `site/src/lib/api.ts`
- Create: `site/src/pages/douban.astro`
- Modify: `site/src/styles/themes/reader.css`
- Modify: `site/src/styles/themes/normal.css`

**Step 1: api.ts 扩展**

修改 `site/src/lib/api.ts`：

1. `PublicSettings` 增加字段：

```ts
  doubanEnabled: boolean;
  doubanUid: string;
```

2. 新增接口与函数（放在 `getProjects` 附近）：

```ts
export interface DoubanMovie {
  title: string;
  url: string;
  cover: string;
  rating: number;
  ratingText: string;
  date: string;
}
export interface DoubanData {
  enabled: boolean;
  uid?: string;
  movies: DoubanMovie[];
  error?: string;
  stale?: boolean;
}
export const getDouban = () => get<DoubanData>('/douban');
```

3. `getPublicSettings` 的 fallback 增加 `doubanEnabled: false, doubanUid: ''`。

**Step 2: 创建 douban.astro**

创建 `site/src/pages/douban.astro`：

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { getDouban } from '../lib/api';

const data = await getDouban().catch((): { enabled: boolean; movies: { title: string; url: string; cover: string; rating: number; date: string }[]; error?: string } => ({
  enabled: false,
  movies: [],
  error: '加载失败',
}));
---
<BaseLayout title="影音">
  <h1 class="page-title">影音</h1>

  {!data.enabled ? (
    <p class="douban-empty">暂未开启豆瓣影音展示</p>
  ) : data.error ? (
    <div class="douban-empty">
      <p>{data.error}</p>
      {data.uid && <a href={`https://www.douban.com/people/${data.uid}/`} target="_blank" rel="noopener noreferrer">访问豆瓣主页</a>}
    </div>
  ) : data.movies.length === 0 ? (
    <p class="douban-empty">暂无看过记录</p>
  ) : (
    <div class="douban-grid">
      {data.movies.map((m) => (
        <a class="douban-card" href={m.url} target="_blank" rel="noopener noreferrer">
          <span class="douban-cover">
            {m.cover ? <img src={m.cover} alt={m.title} loading="lazy" /> : <span class="douban-cover-fallback">{m.title.slice(0, 1)}</span>}
          </span>
          <span class="douban-title">{m.title}</span>
          <span class="douban-meta">
            {m.rating > 0 && <span class="douban-stars">{'★'.repeat(m.rating)}<i>{'☆'.repeat(5 - m.rating)}</i></span>}
            {m.date && <span class="douban-date">{m.date}</span>}
          </span>
        </a>
      ))}
    </div>
  )}
</BaseLayout>

<style is:global>
  .page-title { font-size: 22px; margin-bottom: 20px; max-width: var(--max-width); margin-left: auto; margin-right: auto; }
  .douban-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 24px 16px;
    max-width: var(--max-width);
    margin: 0 auto;
  }
  .douban-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    text-decoration: none;
    color: var(--color-text);
  }
  .douban-cover {
    display: block;
    aspect-ratio: 2 / 3;
    border-radius: var(--radius);
    overflow: hidden;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
  }
  .douban-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .douban-cover-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    font-weight: 600;
    color: var(--color-text-muted);
  }
  .douban-title {
    font-size: 14px;
    line-height: 1.5;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .douban-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .douban-stars { color: var(--color-primary); font-size: 12px; letter-spacing: 1px; }
  .douban-stars i { color: var(--color-border-strong); font-style: normal; }
  .douban-date { color: var(--color-text-muted); font-size: 12px; }
  .douban-empty {
    text-align: center;
    color: var(--color-text-muted);
    padding: 64px 0;
    max-width: var(--max-width);
    margin: 0 auto;
  }
</style>
```

**Step 3: 双主题样式**

- 极简模式（`site/src/styles/themes/reader.css` 末尾追加）：

```css
/* ---------- 豆瓣影音页：克制海报墙 ---------- */
[data-theme='reader'] .douban-grid {
  max-width: 760px;
}
[data-theme='reader'] .douban-card {
  color: var(--color-text-primary);
}
[data-theme='reader'] .douban-title {
  font-family: var(--font-display);
  font-size: 0.9rem;
  transition: color 0.18s ease;
}
[data-theme='reader'] .douban-card:hover .douban-title {
  color: var(--color-primary);
}
[data-theme='reader'] .douban-cover {
  border: 1px solid var(--color-border);
  border-radius: 2px;
}
[data-theme='reader'] .douban-meta {
  font-family: var(--font-ui);
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
[data-theme='reader'] .douban-stars {
  color: var(--color-primary);
  font-size: 0.75rem;
}
[data-theme='reader'] .douban-date {
  color: var(--color-text-muted);
  opacity: 0.8;
}
```

- 正常主题（`site/src/styles/themes/normal.css` 末尾追加）：

```css
/* 豆瓣影音页：海报卡片 */
[data-theme='normal'] .douban-card:hover .douban-title {
  color: var(--color-primary);
}
[data-theme='normal'] .douban-stars {
  color: var(--color-primary);
}
```

**Step 4: 验证**

Run: `cd E:/zcodework/MBLOG/site && npx astro check`
Expected: 0 errors。`curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/douban` → 200（未开启时显示「暂未开启」）。

**Step 5: 提交**

```bash
git add site/src/lib/api.ts site/src/pages/douban.astro site/src/styles/themes/reader.css site/src/styles/themes/normal.css
git commit -m "feat: 前台豆瓣影音展示页（双主题海报墙）"
```

---

### Task 3: 后台豆瓣配置

**Files:**
- Modify: `admin/src/views/SettingsPage.vue`

**Step 1: 添加 fieldset**

在「GitHub 项目展示」fieldset 之后插入：

```html
      <fieldset>
        <legend>豆瓣影音展示</legend>
        <label>开启展示
          <select v-model="form.douban_enabled">
            <option value="1">开启</option>
            <option value="0">关闭</option>
          </select>
        </label>
        <label>豆瓣用户 ID
          <input v-model="form.douban_uid" placeholder="douban 主页 /people/ 后的数字" />
        </label>
        <p class="menu-tip">前台 /douban 页面将展示该用户「看过」的电影（封面/评分/日期）。需在导航菜单中添加「影音」链接。</p>
      </fieldset>
```

**Step 2: 验证**

Run: `cd E:/zcodework/MBLOG/admin && npm run typecheck`
Expected: 0 errors。

**Step 3: 提交**

```bash
git add admin/src/views/SettingsPage.vue
git commit -m "feat: 后台设置页新增豆瓣影音配置"
```

---

### Task 4: 端到端验证 + 收尾

**Files:** 无新增

**Step 1: 全量测试与检查**

```bash
cd E:/zcodework/MBLOG/backend && npx vitest run
cd E:/zcodework/MBLOG/site && npx astro check
cd E:/zcodework/MBLOG/admin && npm run typecheck
```

Expected: 全部通过。

**Step 2: 浏览器实测**

- 后台设置 douban_enabled=1 + douban_uid（如 1017197）→ 前台 `/douban` 显示海报网格
- 未开启 → 「暂未开启」空态；失败 → 错误态
- 双主题切换正常；normal 主题布局不受影响

**Step 3: 提交修复**

```bash
git add -A
git commit -m "fix: 豆瓣影音端到端修复"
```

**Step 4: 收尾确认**

```bash
git status --short  # 期望空
git log --oneline -6
```
