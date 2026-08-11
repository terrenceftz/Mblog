# 正常主题暗色改造 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 正常主题全面改为暗色 eonova 风格：首页重构为内容丰富模块页，全站暗色适配，极简主题完全隔离。

**设计文档:** `docs/superpowers/specs/2026-08-11-normal-theme-dark-design.md`

---

## 任务概览

1. 后端：公共 `/api/stats` 接口 + 测试
2. 前台：`index.astro` 双渲染（reader-home + normal-home）+ `api.ts` getStats
3. CSS：`normal.css` 暗色重写（配色/全页组件/首页模块）
4. 隔离 + 后台：reader 隐藏 normal-home + admin DEFAULTS.normal 暗色
5. 端到端验证

---

### Task 1: 公共统计接口

**Files:**
- Create: `backend/src/routes/public/stats.ts`
- Modify: `backend/src/routes/public.ts`
- Create: `backend/test/stats.test.ts`

**Step 1: 创建路由**

创建 `backend/src/routes/public/stats.ts`：

```ts
import { Hono } from 'hono';
import { eq, count } from 'drizzle-orm';
import { posts, comments, friendLinks } from '../../db/schema';
import type { Db } from '../../db';

// 前台首页数据统计：文章 / 评论 / 浏览 / 友链
export function statsRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/stats', (c) => {
    const postTotal = ctx.db.select({ n: count() }).from(posts).where(eq(posts.status, 'published')).get()?.n ?? 0;
    const commentTotal = ctx.db.select({ n: count() }).from(comments).where(eq(comments.status, 'approved')).get()?.n ?? 0;
    const totalViews = ctx.db.select({ n: posts.viewCount }).from(posts).all().reduce((s, r) => s + r.n, 0);
    const friendLinkCount = ctx.db.select({ n: count() }).from(friendLinks).where(eq(friendLinks.status, 'approved')).get()?.n ?? 0;
    return c.json({ data: { postTotal, commentTotal, totalViews, friendLinkCount } });
  });

  return app;
}
```

修改 `backend/src/routes/public.ts`：加 `import { statsRoutes } from './public/stats';` 并挂载 `app.route('/', statsRoutes(ctx));`。

**Step 2: 编写测试**

创建 `backend/test/stats.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { makeTestApp, loginAsAdmin, authHeaders } from './helpers';

describe('公共统计接口 /api/stats', () => {
  it('返回文章/评论/浏览/友链统计', async () => {
    const { app } = makeTestApp();
    // 造数：1 篇发布 + 1 篇草稿、1 条已审评论、1 条已审友链
    const token = await loginAsAdmin(app);
    const put = (body: unknown) =>
      app.request('/api/admin/posts', { method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders(token) }, body: JSON.stringify(body) });
    const post1 = await put({ title: '发布文', slug: 'pub', contentMd: '# hi', status: 'published' });
    await put({ title: '草稿文', slug: 'draft', contentMd: '# hi', status: 'draft' });
    expect(post1.status).toBe(201);
    // 评论
    const comments = await app.request('/api/comments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ post_id: 1, author: 'a', email: 'a@a.com', content: 'x' }) });
    expect(comments.status).toBe(201);
    // 友链
    await app.request('/api/friend-links', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'F', url: 'https://f.com' }) });
    // 审批评论与友链
    const adminApprovals = async () => {
      const listC = (await (await app.request('/api/admin/comments', { headers: authHeaders(token) })).json()) as { data: { list: { id: number }[] } };
      for (const c of listC.data.list) await app.request(`/api/admin/comments/${c.id}/status`, { method: 'PUT', headers: { 'content-type': 'application/json', ...authHeaders(token) }, body: JSON.stringify({ status: 'approved' }) });
      const listF = (await (await app.request('/api/admin/friend-links', { headers: authHeaders(token) })).json()) as { data: { list: { id: number }[] } };
      for (const f of listF.data.list) await app.request(`/api/admin/friend-links/${f.id}/status`, { method: 'PUT', headers: { 'content-type': 'application/json', ...authHeaders(token) }, body: JSON.stringify({ status: 'approved' }) });
    };
    await adminApprovals();

    const res = await app.request('/api/stats');
    const body = (await res.json()) as { data: { postTotal: number; commentTotal: number; totalViews: number; friendLinkCount: number } };
    expect(body.data.postTotal).toBe(1); // 仅发布
    expect(body.data.commentTotal).toBe(1);
    expect(body.data.friendLinkCount).toBe(1);
    expect(body.data.totalViews).toBeGreaterThanOrEqual(0);
  });
});
```

注意：若实际后端已有评论/友链审批接口的路径不同，先读 `backend/src/routes/admin/comments.ts` 与 `friendLinks.ts` 确认接口路径/请求体，按实际路径写测试（核心断言：postTotal 只统计 published、friendLinkCount 只统计 approved）。

**Step 3: 运行测试**

Run: `cd E:/zcodework/MBLOG/backend && npx vitest run test/stats.test.ts`（若该测试造数流程与现有接口不符，允许调整造数步骤，保持断言语义）。
随后 `npx vitest run` 全量与 `npx tsc --noEmit`。

**Step 4: 提交**

```bash
git add backend/src/routes/public/stats.ts backend/src/routes/public.ts backend/test/stats.test.ts
git commit -m "feat: 公共统计接口 /api/stats（文章/评论/浏览/友链）"
```

---

### Task 2: index.astro 双渲染 + api getStats

**Files:**
- Modify: `site/src/lib/api.ts`
- Modify: `site/src/pages/index.astro`

**Step 1: api.ts 扩展**

`site/src/lib/api.ts` 追加：

```ts
export interface StatsData {
  postTotal: number;
  commentTotal: number;
  totalViews: number;
  friendLinkCount: number;
}
export const getStats = () => get<StatsData>('/stats');
```

**Step 2: index.astro 重写**

用以下完整内容替换 `site/src/pages/index.astro`（保留极简时间线于 `.reader-home`，新增 `.normal-home`）：

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import {
  getPosts, getPublicSettings, getCategories, getTags, getStats, getDouban, getProjects,
  type PostListItem,
} from '../lib/api';

const settings = await getPublicSettings();
// 首页文章数：默认主题配置决定（双主题架构下 SSR 以默认主题为准）
const defaultTheme = settings.theme === 'reader' ? settings.themeReader : settings.themeNormal;
const pageSize = defaultTheme.homePageSize ?? 10;
const page = Math.max(1, Number(Astro.url.searchParams.get('page') ?? 1));
const data = await getPosts({ page, pageSize });
const total = data.total;
const totalPages = Math.max(1, Math.ceil(total / pageSize));

// 干支纪年：2026 -> 丙午
const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
function yearGanzhi(year: number): string {
  return GAN[(year - 4) % 10] + ZHI[(year - 4) % 12];
}
function fmtMonthDay(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const yearGroups: { year: number; ganzhi: string; items: PostListItem[] }[] = [];
for (const post of data.list) {
  const y = new Date(post.createdAt).getFullYear();
  const last = yearGroups[yearGroups.length - 1];
  if (last && last.year === y) last.items.push(post);
  else yearGroups.push({ year: y, ganzhi: yearGanzhi(y), items: [post] });
}

// 正常主题首页数据（各模块；失败时优雅降级为空）
const [categories, tags, stats, doubanData, projectsData] = await Promise.all([
  getCategories().catch(() => []),
  getTags().catch(() => []),
  getStats().catch(() => ({ postTotal: 0, commentTotal: 0, totalViews: 0, friendLinkCount: 0 })),
  getDouban().catch(() => ({ enabled: false, movies: [] })),
  getProjects().catch(() => ({ enabled: false, projects: [] })),
]);
const catName = (id: number | null) => categories.find((c) => c.id === id)?.name ?? '';
---
<BaseLayout description={settings.siteDesc}>

  <!-- ======== 极简主题首页：干支时间线（normal 主题隐藏） ======== -->
  <div class="reader-home">
    <div class="content-stream">
      {yearGroups.map((g) => (
        <section class="year-group">
          <h2 class="year-label" id={`year-${g.year}`} title={String(g.year)}>{g.ganzhi}</h2>
          <ul class="year-list">
            {g.items.map((post) => (
              <li class="year-item">
                <div class="item-main">
                  <span class="item-date">{fmtMonthDay(post.createdAt)}</span>
                  <a class="item-title" href={`/post/${post.slug}`}>{post.title}</a>
                </div>
                {post.summary && <p class="item-summary">{post.summary}</p>}
                <span class="item-views">👁 {post.viewCount}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {data.list.length === 0 && <p class="post-empty">暂无文章</p>}
    </div>
    {totalPages > 1 && (
      <nav class="pagination">
        {page > 1 && <a href={`/?page=${page - 1}`}>← 前页</a>}
        <span class="page-info">{page} / {totalPages}</span>
        {page < totalPages && <a href={`/?page=${page + 1}`}>后页 →</a>}
      </nav>
    )}
  </div>

  <!-- ======== 正常主题首页：内容丰富模块（极简主题隐藏） ======== -->
  <div class="normal-home">
    <!-- Hero -->
    <section class="nh-hero">
      <p class="nh-eyebrow">NOVA EON · BLOG</p>
      <h1 class="nh-title">{siteName}</h1>
      {settings.siteDesc && <p class="nh-desc">{settings.siteDesc}</p>}
      <div class="nh-hero-banner"><img src="/banner.png" alt={siteName} /></div>
    </section>

    <!-- 数据统计 -->
    <section class="nh-stats">
      <div class="nh-stat"><span class="num">{stats.postTotal}</span><span class="label">文章</span></div>
      <div class="nh-stat"><span class="num">{stats.commentTotal}</span><span class="label">评论</span></div>
      <div class="nh-stat"><span class="num">{stats.totalViews}</span><span class="label">总浏览</span></div>
      <div class="nh-stat"><span class="num">{stats.friendLinkCount}</span><span class="label">友链</span></div>
    </section>

    <!-- 最新文章 -->
    <section class="nh-section">
      <div class="nh-section-head"><p class="nh-eyebrow">LATEST POSTS</p><h2>最新文章</h2></div>
      <div class="nh-post-grid">
        {data.list.map((p) => (
          <a class="nh-post-card" href={`/post/${p.slug}`}>
            <div class="nh-post-cover">
              {p.cover ? (
                <img src={p.cover} alt="" loading="lazy" />
              ) : (
                <span class="nh-post-cover-fallback">{p.title.slice(0, 1)}</span>
              )}
            </div>
            <div class="nh-post-body">
              <h3 class="nh-post-title">{p.title}</h3>
              {p.summary && <p class="nh-post-summary">{p.summary}</p>}
              <div class="nh-post-meta">
                <span>{fmtMonthDay(p.createdAt)}</span>
                <span>👁 {p.viewCount}</span>
                {catName(p.categoryId) && <span>{catName(p.categoryId)}</span>}
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>

    <!-- 分类与标签 -->
    <section class="nh-section">
      <div class="nh-section-head"><p class="nh-eyebrow">EXPLORE</p><h2>分类与标签</h2></div>
      <div class="nh-cats">
        {categories.map((c) => (
          <a class="nh-cat" href={`/category/${c.slug}`}>{c.name}<span class="nh-cat-count">{c.postCount}</span></a>
        ))}
      </div>
      <div class="nh-tags">
        {tags.map((t) => (
          <a class="nh-tag" href={`/tag/${t.slug}`}>#{t.name}</a>
        ))}
      </div>
    </section>

    <!-- 影音与项目 -->
    <section class="nh-section">
      <div class="nh-sub">
        <div class="nh-section-head nh-sub-head">
          <div><p class="nh-eyebrow">MOVIES</p><h2>最近观影</h2></div>
          <a class="nh-more" href="/douban">查看全部 →</a>
        </div>
        {doubanData.movies.length > 0 && (
          <div class="nh-douban">
            {doubanData.movies.slice(0, 8).map((m) => (
              <a class="nh-douban-item" href={m.url} target="_blank" rel="noopener noreferrer" title={m.title}>
                {m.cover ? <img src={m.cover} alt={m.title} loading="lazy" /> : <span class="nh-douban-fallback">{m.title.slice(0, 1)}</span>}
              </a>
            ))}
          </div>
        )}
      </div>
      <div class="nh-sub">
        <div class="nh-section-head nh-sub-head">
          <div><p class="nh-eyebrow">PROJECTS</p><h2>精选项目</h2></div>
          <a class="nh-more" href="/projects">查看全部 →</a>
        </div>
        {projectsData.projects.length > 0 && (
          <div class="nh-projects">
            {projectsData.projects.slice(0, 6).map((p) => (
              <a class="nh-project" href={p.url} target="_blank" rel="noopener noreferrer">
                <span class="nh-project-name">{p.name}</span>
                {p.description && <span class="nh-project-desc">{p.description}</span>}
                {p.language && <span class="nh-project-lang">{p.language}</span>}
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  </div>
</BaseLayout>

<style is:global>
  /* 分页默认样式（极简模式由 reader.css 覆盖） */
  .pagination {
    display: flex; gap: 16px; align-items: center; justify-content: center;
    padding: 24px 0; max-width: var(--max-width); margin: 0 auto;
  }
  .pagination a { color: var(--color-text); text-decoration: none; border: 1px solid var(--color-border); border-radius: var(--radius); padding: 6px 14px; background: var(--color-surface); }
  .pagination a:hover { color: var(--color-primary); border-color: var(--color-primary); }
  .page-info { color: var(--color-text-muted); font-size: 14px; }
</style>
```

**Step 3: 验证编译**

Run: `cd E:/zcodework/MBLOG/site && npx astro check`
Expected: 0 errors（既有 1 个 hint 可忽略）。

**Step 4: 提交**

```bash
git add site/src/lib/api.ts site/src/pages/index.astro
git commit -m "feat: 首页双渲染——极简时间线与正常主题内容模块页"
```

---

### Task 3: normal.css 暗色重写

**Files:**
- Rewrite: `site/src/styles/themes/normal.css`

**Step 1: 重写 normal.css**

用以下完整内容**整体替换** `site/src/styles/themes/normal.css`：

```css
/* =========================================================
   正常主题：eonova 暗色科技风
   首页为内容丰富模块页；全站暗色卡片风格
   ========================================================= */

[data-theme='normal'] {
  --color-bg: #09090b;
  --color-surface: #131316;
  --color-text: #f4f4f5;
  --color-text-muted: #9d9d95;
  --color-primary: #e8b64c;
  --color-primary-contrast: #09090b;
  --color-border: #26262a;
  --color-code-bg: #18181b;
  --color-text-secondary: #a1a1aa;
  --color-text-heading: #fafafa;
  --color-border-strong: #3f3f46;
  --color-accent-subtle: rgba(232, 182, 76, 0.12);
  --radius: 12px;
  --max-width: 1100px;
  --shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
  --card-padding: 20px;
  --font-body: system-ui, -apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', sans-serif;
  --font-display: system-ui, -apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  --font-ui: system-ui, -apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
}

[data-theme='normal'] body {
  background: var(--color-bg);
  color: var(--color-text);
}

/* ---------- 顶栏 ---------- */
[data-theme='normal'] .site-header {
  background: rgba(9, 9, 11, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 100;
}
[data-theme='normal'] .site-header .nav a {
  color: var(--color-text-muted);
  transition: color 0.2s ease;
}
[data-theme='normal'] .site-header .nav a:hover {
  color: var(--color-primary);
}

/* ---------- 侧栏（极简用）在正常主题隐藏 ---------- */
[data-theme='normal'] .sidebar {
  display: none;
}
[data-theme='normal'] .page-layout {
  display: contents;
}

/* ---------- 极简首页（时间线）在正常主题隐藏 ---------- */
[data-theme='normal'] .reader-home {
  display: none;
}

/* ---------- 正常主题首页模块 ---------- */
[data-theme='normal'] .normal-home {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 24px 20px 80px;
}

/* Hero */
[data-theme='normal'] .nh-hero {
  text-align: center;
  padding: 56px 0 40px;
}
[data-theme='normal'] .nh-eyebrow {
  font-size: 12px;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--color-primary);
  margin: 0 0 12px;
  font-weight: 600;
}
[data-theme='normal'] .nh-title {
  font-size: clamp(2.5rem, 6vw, 3.5rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--color-text-heading);
  margin: 0 0 12px;
}
[data-theme='normal'] .nh-desc {
  color: var(--color-text-muted);
  font-size: 17px;
  max-width: 560px;
  margin: 0 auto;
  line-height: 1.7;
}
[data-theme='normal'] .nh-hero-banner {
  margin: 40px auto 0;
  max-width: 860px;
}
[data-theme='normal'] .nh-hero-banner img {
  width: 100%;
  height: auto;
  border-radius: 16px;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow);
  display: block;
}

/* 数据统计 */
[data-theme='normal'] .nh-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-top: 40px;
}
[data-theme='normal'] .nh-stat {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 20px 12px;
  text-align: center;
}
[data-theme='normal'] .nh-stat .num {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-heading);
  font-variant-numeric: tabular-nums;
}
[data-theme='normal'] .nh-stat .label {
  display: block;
  margin-top: 4px;
  font-size: 13px;
  color: var(--color-text-muted);
}

/* 区块 */
[data-theme='normal'] .nh-section {
  margin-top: 56px;
}
[data-theme='normal'] .nh-section-head {
  margin-bottom: 20px;
}
[data-theme='normal'] .nh-section-head h2 {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-heading);
  margin: 4px 0 0;
}

/* 最新文章卡片 */
[data-theme='normal'] .nh-post-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}
[data-theme='normal'] .nh-post-card {
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  transition: transform 0.2s ease, border-color 0.2s ease;
}
[data-theme='normal'] .nh-post-card:hover {
  transform: translateY(-4px);
  border-color: var(--color-border-strong);
}
[data-theme='normal'] .nh-post-cover {
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: linear-gradient(135deg, #1e1e24, #2a2a33);
}
[data-theme='normal'] .nh-post-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
[data-theme='normal'] .nh-post-cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  font-weight: 800;
  color: rgba(244, 244, 245, 0.25);
}
[data-theme='normal'] .nh-post-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}
[data-theme='normal'] .nh-post-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-heading);
  margin: 0;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
[data-theme='normal'] .nh-post-card:hover .nh-post-title {
  color: var(--color-primary);
}
[data-theme='normal'] .nh-post-summary {
  color: var(--color-text-muted);
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
}
[data-theme='normal'] .nh-post-meta {
  display: flex;
  gap: 14px;
  color: var(--color-text-muted);
  font-size: 12px;
  flex-wrap: wrap;
}

/* 分类与标签 */
[data-theme='normal'] .nh-cats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
[data-theme='normal'] .nh-cat {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 16px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: 14px;
  transition: color 0.2s ease, border-color 0.2s ease;
}
[data-theme='normal'] .nh-cat:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
}
[data-theme='normal'] .nh-cat-count {
  font-size: 12px;
  color: var(--color-text-muted);
  opacity: 0.7;
}
[data-theme='normal'] .nh-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}
[data-theme='normal'] .nh-tag {
  padding: 3px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: 12px;
  transition: color 0.2s ease, border-color 0.2s ease;
}
[data-theme='normal'] .nh-tag:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

/* 影音与项目 */
[data-theme='normal'] .nh-sub {
  margin-top: 40px;
}
[data-theme='normal'] .nh-sub-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}
[data-theme='normal'] .nh-more {
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: 14px;
  transition: color 0.2s ease;
  white-space: nowrap;
}
[data-theme='normal'] .nh-more:hover {
  color: var(--color-primary);
}
[data-theme='normal'] .nh-douban {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 12px;
}
[data-theme='normal'] .nh-douban-item {
  aspect-ratio: 2 / 3;
  border-radius: 10px;
  overflow: hidden;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}
[data-theme='normal'] .nh-douban-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.2s ease;
}
[data-theme='normal'] .nh-douban-item:hover img {
  transform: scale(1.05);
}
[data-theme='normal'] .nh-douban-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  font-size: 20px;
  font-weight: 700;
}
[data-theme='normal'] .nh-projects {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
}
[data-theme='normal'] .nh-project {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  text-decoration: none;
  color: inherit;
  transition: transform 0.2s ease, border-color 0.2s ease;
}
[data-theme='normal'] .nh-project:hover {
  transform: translateY(-3px);
  border-color: var(--color-border-strong);
}
[data-theme='normal'] .nh-project-name {
  font-weight: 600;
  color: var(--color-text-heading);
}
[data-theme='normal'] .nh-project-desc {
  color: var(--color-text-muted);
  font-size: 13px;
  line-height: 1.5;
}
[data-theme='normal'] .nh-project-lang {
  align-self: flex-start;
  font-size: 11px;
  color: var(--color-primary);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 1px 8px;
}

/* ---------- 通用页面组件（暗色） ---------- */
[data-theme='normal'] .page-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-heading);
  margin-bottom: 20px;
  max-width: var(--max-width);
  margin-left: auto;
  margin-right: auto;
}
[data-theme='normal'] .post-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: var(--card-padding);
}
[data-theme='normal'] .post-card:hover {
  border-color: var(--color-border-strong);
}
[data-theme='normal'] .post-card .post-title a {
  color: var(--color-text-heading);
}
[data-theme='normal'] .post-card .post-title a:hover {
  color: var(--color-primary);
}
[data-theme='normal'] .pagination a {
  background: var(--color-surface);
}

/* 文章页 */
[data-theme='normal'] .article-wrapper {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 32px 20px 64px;
}
[data-theme='normal'] .article-title {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-text-heading);
  margin: 0 0 12px;
  line-height: 1.3;
}
[data-theme='normal'] .article-meta {
  color: var(--color-text-muted);
  font-size: 14px;
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 32px;
}
[data-theme='normal'] .article-meta a {
  color: var(--color-text-muted);
}
[data-theme='normal'] .article-footer {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border);
}
[data-theme='normal'] .tags {
  list-style: none;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 0;
  padding: 0;
}
[data-theme='normal'] .tag {
  font-size: 13px;
  color: var(--color-primary);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 3px 12px;
  text-decoration: none;
  transition: color 0.2s ease, border-color 0.2s ease;
}
[data-theme='normal'] .tag:hover {
  border-color: var(--color-primary);
}

/* 友链 / 项目 / 影音 / 归档 / 搜索 */
[data-theme='normal'] .link-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
  max-width: var(--max-width);
  margin: 0 auto;
}
[data-theme='normal'] .link-card {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 14px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  text-decoration: none;
  color: var(--color-text);
  transition: border-color 0.2s ease, transform 0.2s ease;
}
[data-theme='normal'] .link-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-2px);
}
[data-theme='normal'] .link-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-primary-contrast);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}
[data-theme='normal'] .link-name {
  font-weight: 600;
  color: var(--color-text-heading);
}
[data-theme='normal'] .link-desc {
  color: var(--color-text-muted);
  font-size: 13px;
  margin-top: 2px;
}
[data-theme='normal'] .project-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
  max-width: var(--max-width);
  margin: 0 auto;
}
[data-theme='normal'] .project-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  text-decoration: none;
  color: var(--color-text);
  transition: border-color 0.2s ease, transform 0.2s ease;
}
[data-theme='normal'] .project-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-2px);
}
[data-theme='normal'] .project-name {
  font-weight: 600;
  color: var(--color-text-heading);
}
[data-theme='normal'] .project-lang {
  font-size: 12px;
  color: var(--color-primary);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 1px 8px;
}
[data-theme='normal'] .project-desc,
[data-theme='normal'] .project-stars,
[data-theme='normal'] .project-updated {
  color: var(--color-text-muted);
  font-size: 12px;
}
[data-theme='normal'] .douban-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 24px 16px;
  max-width: var(--max-width);
  margin: 0 auto;
}
[data-theme='normal'] .douban-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-decoration: none;
  color: var(--color-text);
}
[data-theme='normal'] .douban-cover {
  display: block;
  aspect-ratio: 2 / 3;
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}
[data-theme='normal'] .douban-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
[data-theme='normal'] .douban-card:hover .douban-title {
  color: var(--color-primary);
}
[data-theme='normal'] .douban-title {
  font-size: 14px;
  color: var(--color-text-heading);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
[data-theme='normal'] .douban-stars {
  color: var(--color-primary);
  font-size: 12px;
  letter-spacing: 1px;
}
[data-theme='normal'] .douban-stars i {
  color: var(--color-border-strong);
  font-style: normal;
}
[data-theme='normal'] .douban-date {
  color: var(--color-text-muted);
  font-size: 12px;
}
[data-theme='normal'] .douban-empty,
[data-theme='normal'] .link-empty,
[data-theme='normal'] .projects-empty,
[data-theme='normal'] .post-empty {
  text-align: center;
  color: var(--color-text-muted);
  padding: 64px 0;
}

/* 归档 */
[data-theme='normal'] .archive-group {
  max-width: var(--max-width);
  margin: 0 auto;
}
[data-theme='normal'] .archive-group .month {
  font-size: 16px;
  color: var(--color-primary);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 6px;
}
[data-theme='normal'] .archive-group li {
  padding: 6px 0;
  display: flex;
  gap: 12px;
}
[data-theme='normal'] .archive-group .date {
  color: var(--color-text-muted);
  font-size: 13px;
  min-width: 90px;
}
[data-theme='normal'] .archive-group a {
  color: var(--color-text);
  text-decoration: none;
}
[data-theme='normal'] .archive-group a:hover {
  color: var(--color-primary);
}

/* 搜索 */
[data-theme='normal'] .search-form input {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
}
[data-theme='normal'] .search-form button {
  background: var(--color-primary);
  color: var(--color-primary-contrast);
  border: none;
}
[data-theme='normal'] .result-info {
  color: var(--color-text-muted);
}

/* 页脚 */
[data-theme='normal'] .site-footer {
  border-top: 1px solid var(--color-border);
  color: var(--color-text-muted);
}

/* 文章 markdown 暗色微调 */
[data-theme='normal'] .markdown-body a {
  color: var(--color-primary);
}
[data-theme='normal'] .markdown-body blockquote {
  border-left-color: var(--color-primary);
}
```

**Step 2: 验证编译**

Run: `cd E:/zcodework/MBLOG/site && npx astro check` — expect 0 errors。`npx astro build` 确认 CSS 编译通过。

**Step 3: 提交**

```bash
git add site/src/styles/themes/normal.css
git commit -m "feat: 正常主题暗色重写——eonova 科技风配色 + 首页模块 + 全站暗色组件"
```

---

### Task 4: 隔离 + 后台默认值

**Files:**
- Modify: `site/src/styles/themes/reader.css`
- Modify: `admin/src/views/ThemesPage.vue`

**Step 1: reader.css 隔离**

`site/src/styles/themes/reader.css` 末尾追加：

```css
/* 正常主题首页模块在极简模式隐藏 */
[data-theme='reader'] .normal-home {
  display: none;
}
```

**Step 2: admin DEFAULTS.normal 暗色**

`admin/src/views/ThemesPage.vue` 的 `DEFAULTS` 中 normal 行改为：

```ts
  normal: { bg: '#09090b', text: '#f4f4f5', muted: '#9d9d95', primary: '#e8b64c', border: '#26262a', fontSize: 16, homePageSize: 10 },
```

**Step 3: 验证**

- `cd E:/zcodework/MBLOG/site && npx astro check` — 0 errors
- `cd E:/zcodework/MBLOG/admin && npm run typecheck` — 0 errors

**Step 4: 提交**

```bash
git add site/src/styles/themes/reader.css admin/src/views/ThemesPage.vue
git commit -m "fix: 极简模式隐藏 normal-home；后台正常主题默认值同步暗色"
```

---

### Task 5: 端到端验证 + 收尾

**Files:** 无新增

**Step 1: 全量测试与检查**

```bash
cd E:/zcodework/MBLOG/backend && npx vitest run
cd E:/zcodework/MBLOG/site && npx astro check
cd E:/zcodework/MBLOG/admin && npm run typecheck
```

**Step 2: 浏览器实测**

- 正常主题首页：暗色 Hero + 统计卡 + 文章卡片（渐变占位）+ 分类胶囊 + 影音/项目模块
- 正常主题全站页面：文章/归档/友链/项目/影音/搜索/分类/标签 暗色正常
- 极简主题：时间线/侧栏/文章页完全不受影响（隔离验证）
- 后台主题管理：正常主题 Tab 显示暗色默认值；保存后生效

**Step 3: 修复发现的问题并提交**

```bash
git add -A
git commit -m "fix: 正常主题暗色改造端到端修复"
```

**Step 4: 收尾确认**

```bash
git status --short  # 期望空
git log --oneline -8
```
