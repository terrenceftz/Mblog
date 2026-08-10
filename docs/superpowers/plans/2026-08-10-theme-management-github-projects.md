# 主题管理 + GitHub 项目展示 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 后台可分主题管理外观参数与首页文章数，并新增 GitHub 项目展示页（自动拉取公开仓库）。

**Architecture:** 主题配置以 JSON 存入设置中心（`theme_normal`/`theme_reader` 两键），SSR 时注入 CSS 变量覆盖实现生效；GitHub 项目由后端 `/api/projects` 代理拉取 + 内存缓存 30 分钟，前台 `/projects` 页双主题适配。

**Tech Stack:** Node + TypeScript + Hono + Drizzle + better-sqlite3 / Astro 5 SSR / Vue 3 SPA / vitest

**设计文档:** `docs/superpowers/specs/2026-08-10-theme-management-github-projects-design.md`

---

## 任务概览

1. 后端：`lib/themeConfig.ts` 解析工具 + `DEFAULT_SETTINGS` 新键
2. 后端：公开设置 `/api/settings/public` 返回主题配置与 GitHub 字段
3. 后端：GitHub 代理接口 `/api/projects`（拉取 + 过滤 + 缓存）
4. 前台：`api.ts` 类型扩展 + BaseLayout 注入 CSS 变量 + reader.css 字号变量化
5. 前台：首页文章数读取默认主题配置
6. 前台：`/projects` 页面 + 双主题样式
7. 后台：主题管理页 ThemesPage + 路由 + 侧栏导航
8. 后台：设置页 GitHub fieldset
9. 端到端验证 + 提交

---

### Task 1: 后端主题配置解析工具与设置键

**Files:**
- Create: `backend/src/lib/themeConfig.ts`
- Modify: `backend/src/lib/settings.ts`
- Test: `backend/test/theme-github.test.ts`（新建，Task 1–3 共用）

- [ ] **Step 1: 创建解析工具**

创建 `backend/src/lib/themeConfig.ts`：

```ts
export interface ThemeConfig {
  bg?: string;
  text?: string;
  muted?: string;
  primary?: string;
  border?: string;
  fontSize?: number;
  homePageSize?: number;
}

const COLOR_KEYS = ['bg', 'text', 'muted', 'primary', 'border'] as const;

// 解析主题配置 JSON；非法 JSON 或非法值一律丢弃，返回空对象（回退 CSS 默认）
export function parseThemeConfig(raw: string): ThemeConfig {
  if (!raw) return {};
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const o = obj as Record<string, unknown>;
  const out: ThemeConfig = {};
  for (const k of COLOR_KEYS) {
    if (typeof o[k] === 'string' && (o[k] as string).trim()) out[k] = o[k] as string;
  }
  if (Number.isInteger(o.fontSize) && (o.fontSize as number) >= 12 && (o.fontSize as number) <= 24) {
    out.fontSize = o.fontSize as number;
  }
  if (Number.isInteger(o.homePageSize) && (o.homePageSize as number) >= 1 && (o.homePageSize as number) <= 50) {
    out.homePageSize = o.homePageSize as number;
  }
  return out;
}
```

- [ ] **Step 2: 扩展 DEFAULT_SETTINGS**

修改 `backend/src/lib/settings.ts`，在 `nav_menu` 默认项中加入「项目」，并在末尾新增键：

```ts
  nav_menu: JSON.stringify([
    { label: '首页', url: '/' },
    { label: '归档', url: '/archive' },
    { label: '友链', url: '/friends' },
    { label: '项目', url: '/projects' },
    { label: 'RSS', url: '/api/rss' },
  ]),
  // 主题配置（JSON，空串 = 使用 CSS 内置默认）
  theme_normal: '',
  theme_reader: '',
  // GitHub 项目展示
  github_enabled: '0',
  github_username: '',
};
```

- [ ] **Step 3: 编写解析工具测试**

创建 `backend/test/theme-github.test.ts`（本文件后续任务继续追加用例）：

```ts
import { describe, it, expect } from 'vitest';
import { parseThemeConfig } from '../src/lib/themeConfig';

describe('parseThemeConfig', () => {
  it('解析合法 JSON 并过滤非法值', () => {
    const cfg = parseThemeConfig(
      JSON.stringify({ bg: '#f3f0e9', fontSize: 18, homePageSize: 5, evil: 'x', fontSizeBad: 999, homePageSizeBad: -1 }),
    );
    expect(cfg).toEqual({ bg: '#f3f0e9', fontSize: 18, homePageSize: 5 });
  });

  it('空串 / 非法 JSON / 非对象返回空对象', () => {
    expect(parseThemeConfig('')).toEqual({});
    expect(parseThemeConfig('not-json')).toEqual({});
    expect(parseThemeConfig('"str"')).toEqual({});
  });

  it('边界值：fontSize 12–24、homePageSize 1–50', () => {
    expect(parseThemeConfig(JSON.stringify({ fontSize: 11 }))).toEqual({});
    expect(parseThemeConfig(JSON.stringify({ fontSize: 12 }))).toEqual({ fontSize: 12 });
    expect(parseThemeConfig(JSON.stringify({ fontSize: 24 }))).toEqual({ fontSize: 24 });
    expect(parseThemeConfig(JSON.stringify({ fontSize: 25 }))).toEqual({});
    expect(parseThemeConfig(JSON.stringify({ homePageSize: 1 }))).toEqual({ homePageSize: 1 });
    expect(parseThemeConfig(JSON.stringify({ homePageSize: 50 }))).toEqual({ homePageSize: 50 });
    expect(parseThemeConfig(JSON.stringify({ homePageSize: 51 }))).toEqual({});
  });
});
```

- [ ] **Step 4: 运行测试**

Run: `cd backend && npx vitest run test/theme-github.test.ts`
Expected: 3 个用例全部 PASS

- [ ] **Step 5: 提交**

```bash
git add backend/src/lib/themeConfig.ts backend/src/lib/settings.ts backend/test/theme-github.test.ts
git commit -m "feat: 主题配置解析工具 + 设置中心新增主题/GitHub 键"
```

---

### Task 2: 公开设置接口返回主题配置

**Files:**
- Modify: `backend/src/routes/public/misc.ts`
- Test: `backend/test/theme-github.test.ts`

- [ ] **Step 1: 编写失败测试**

在 `backend/test/theme-github.test.ts` 追加：

```ts
import { makeTestApp, loginAsAdmin, authHeaders } from './helpers';

describe('主题配置持久化与公开返回', () => {
  it('保存主题配置后 /api/settings/public 返回解析结果', async () => {
    const { app } = makeTestApp();
    const token = await loginAsAdmin(app);
    const payload = JSON.stringify({
      theme_reader: JSON.stringify({ bg: '#f3f0e9', fontSize: 18, homePageSize: 3 }),
      github_username: 'octocat',
      github_enabled: '1',
    });
    const put = await app.request('/api/admin/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...authHeaders(token) },
      body: payload,
    });
    expect(put.status).toBe(200);

    const pub = await app.request('/api/settings/public');
    expect(pub.status).toBe(200);
    const body = (await pub.json()) as {
      data: { themeReader: Record<string, unknown>; themeNormal: Record<string, unknown>; githubUsername: string; githubEnabled: boolean };
    };
    expect(body.data.themeReader).toEqual({ bg: '#f3f0e9', fontSize: 18, homePageSize: 3 });
    expect(body.data.themeNormal).toEqual({});
    expect(body.data.githubUsername).toBe('octocat');
    expect(body.data.githubEnabled).toBe(true);
  });

  it('未配置时主题配置返回空对象', async () => {
    const { app } = makeTestApp();
    const pub = await app.request('/api/settings/public');
    const body = (await pub.json()) as { data: { themeReader: Record<string, unknown>; githubEnabled: boolean } };
    expect(body.data.themeReader).toEqual({});
    expect(body.data.githubEnabled).toBe(false);
  });
});
```

Run: `cd backend && npx vitest run test/theme-github.test.ts -t "主题配置持久化"`
Expected: FAIL（`/api/settings/public` 尚未返回 themeReader 等字段）

- [ ] **Step 2: 实现**

修改 `backend/src/routes/public/misc.ts`：

```ts
import { getSettings } from '../../lib/settings';
import { parseThemeConfig } from '../../lib/themeConfig';
```

将 `/settings/public` 的取值扩展为：

```ts
    const {
      site_name: siteName, site_description: siteDesc, default_theme: theme,
      friend_link_enabled: friendLinkEnabled, nav_menu: navMenuRaw,
      theme_normal: themeNormalRaw, theme_reader: themeReaderRaw,
      github_enabled: githubEnabled, github_username: githubUsername,
    } = getSettings(ctx, [
      'site_name', 'site_description', 'default_theme', 'friend_link_enabled', 'nav_menu',
      'theme_normal', 'theme_reader', 'github_enabled', 'github_username',
    ]);
```

并在 `return c.json({ data: {...} })` 中追加字段：

```ts
      themeNormal: parseThemeConfig(themeNormalRaw),
      themeReader: parseThemeConfig(themeReaderRaw),
      githubEnabled: githubEnabled === '1',
      githubUsername,
```

- [ ] **Step 3: 运行测试**

Run: `cd backend && npx vitest run test/theme-github.test.ts`
Expected: 全部 PASS（含 Task 1 的 3 个用例）

- [ ] **Step 4: 提交**

```bash
git add backend/src/routes/public/misc.ts backend/test/theme-github.test.ts
git commit -m "feat: 公开设置接口返回主题配置与 GitHub 账号信息"
```

---

### Task 3: GitHub 项目代理接口

**Files:**
- Create: `backend/src/routes/public/github.ts`
- Modify: `backend/src/routes/public.ts`
- Test: `backend/test/theme-github.test.ts`

- [ ] **Step 1: 编写失败测试**

在 `backend/test/theme-github.test.ts` 追加：

```ts
import { vi, beforeEach } from 'vitest';

describe('GitHub 项目接口 /api/projects', () => {
  function reposFixture() {
    return [
      { name: 'a', description: 'A', html_url: 'https://github.com/u/a', language: 'TS', stargazers_count: 5, updated_at: '2026-01-01T00:00:00Z', fork: false },
      { name: 'forked', description: '', html_url: 'x', language: null, stargazers_count: 99, updated_at: '2026-02-01T00:00:00Z', fork: true },
      { name: 'b', description: 'B', html_url: 'https://github.com/u/b', language: 'Rust', stargazers_count: 3, updated_at: '2026-03-01T00:00:00Z', fork: false },
    ];
  }
  async function enableGitHub(app: ReturnType<typeof makeTestApp>['app'], username = 'octocat') {
    const token = await loginAsAdmin(app);
    const put = await app.request('/api/admin/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify({ github_enabled: '1', github_username: username }),
    });
    expect(put.status).toBe(200);
  }

  it('未开启时返回 enabled:false', async () => {
    const { app } = makeTestApp();
    const res = await app.request('/api/projects');
    const body = (await res.json()) as { data: { enabled: boolean } };
    expect(body.data.enabled).toBe(false);
  });

  it('拉取仓库：过滤 fork、按星数降序', async () => {
    const { app } = makeTestApp();
    await enableGitHub(app);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => reposFixture() });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res = await app.request('/api/projects');
      const body = (await res.json()) as { data: { enabled: boolean; projects: { name: string; stars: number }[] } };
      expect(body.data.enabled).toBe(true);
      expect(body.data.projects.map((p) => p.name)).toEqual(['a', 'b']);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('缓存生效：TTL 内第二次请求不再调用 fetch', async () => {
    const { app } = makeTestApp();
    await enableGitHub(app);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => reposFixture() });
    vi.stubGlobal('fetch', fetchMock);
    try {
      await app.request('/api/projects');
      await app.request('/api/projects');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('拉取失败返回 error 提示', async () => {
    const { app } = makeTestApp();
    await enableGitHub(app);
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res = await app.request('/api/projects');
      const body = (await res.json()) as { data: { error: string; projects: unknown[] } };
      expect(body.data.error).toBeTruthy();
      expect(body.data.projects).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
```

Run: `cd backend && npx vitest run test/theme-github.test.ts -t "GitHub 项目接口"`
Expected: FAIL（接口不存在，404）

- [ ] **Step 2: 实现路由**

创建 `backend/src/routes/public/github.ts`：

```ts
import { Hono } from 'hono';
import { getSetting } from '../../lib/settings';
import type { Db } from '../../db';

export interface Project {
  name: string;
  description: string;
  url: string;
  language: string | null;
  stars: number;
  updatedAt: string;
}

interface GitHubRepo {
  name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  fork: boolean;
}

const TTL = 30 * 60 * 1000; // GitHub 匿名限流 60 次/小时，缓存 30 分钟
const MAX_REPOS = 20;

// 拉取 + 过滤（排除 fork）+ 按星数降序 + 截取前 20
export async function fetchGitHubProjects(username: string): Promise<Project[]> {
  const res = await fetch(
    `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`,
    { headers: { 'User-Agent': 'MBLOG', Accept: 'application/vnd.github+json' } },
  );
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const repos = (await res.json()) as GitHubRepo[];
  return repos
    .filter((r) => !r.fork)
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, MAX_REPOS)
    .map((r) => ({
      name: r.name,
      description: r.description ?? '',
      url: r.html_url,
      language: r.language,
      stars: r.stargazers_count,
      updatedAt: r.updated_at,
    }));
}

export function githubRoutes(ctx: Db) {
  // 缓存按 app 隔离（每个测试 app 独立），键为用户名的全小写
  const cache = new Map<string, { time: number; data: Project[] }>();

  const app = new Hono();

  app.get('/projects', async (c) => {
    if (getSetting(ctx, 'github_enabled') !== '1') {
      return c.json({ data: { enabled: false, projects: [] } });
    }
    const username = getSetting(ctx, 'github_username').trim();
    if (!username) {
      return c.json({ data: { enabled: false, projects: [] } });
    }
    const key = username.toLowerCase();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.time < TTL) {
      return c.json({ data: { enabled: true, username, projects: hit.data } });
    }
    try {
      const projects = await fetchGitHubProjects(username);
      cache.set(key, { time: Date.now(), data: projects });
      return c.json({ data: { enabled: true, username, projects } });
    } catch {
      if (hit) {
        return c.json({ data: { enabled: true, username, projects: hit.data, stale: true } });
      }
      return c.json({ data: { enabled: true, username, projects: [], error: 'GitHub 拉取失败，请稍后重试' } });
    }
  });

  return app;
}
```

修改 `backend/src/routes/public.ts`，挂载新路由：

```ts
import { githubRoutes } from './public/github';
// ...
  app.route('/', githubRoutes(ctx));
```

- [ ] **Step 3: 运行测试**

Run: `cd backend && npx vitest run test/theme-github.test.ts`
Expected: 全部 PASS

- [ ] **Step 4: 提交**

```bash
git add backend/src/routes/public/github.ts backend/src/routes/public.ts backend/test/theme-github.test.ts
git commit -m "feat: GitHub 项目代理接口（拉取+过滤+缓存）"
```

---

### Task 4: 前台类型扩展 + SSR 注入主题 CSS 变量

**Files:**
- Modify: `site/src/lib/api.ts`
- Modify: `site/src/layouts/BaseLayout.astro`
- Modify: `site/src/styles/themes/reader.css`

- [ ] **Step 1: 扩展前台 API 客户端**

修改 `site/src/lib/api.ts`：

```ts
export interface ThemeConfig {
  bg?: string; text?: string; muted?: string; primary?: string; border?: string;
  fontSize?: number; homePageSize?: number;
}
export interface PublicSettings {
  siteName: string;
  siteDesc: string;
  theme: string;
  friendLinkEnabled: boolean;
  navMenu: { label: string; url: string }[];
  themeNormal: ThemeConfig;
  themeReader: ThemeConfig;
  githubEnabled: boolean;
  githubUsername: string;
}
export interface Project {
  name: string; description: string; url: string;
  language: string | null; stars: number; updatedAt: string;
}
export interface ProjectsData {
  enabled: boolean; username?: string; projects: Project[]; error?: string; stale?: boolean;
}
```

更新 `getPublicSettings` 的 fallback 对象：

```ts
    siteName: '我的博客', siteDesc: '', theme: 'normal', friendLinkEnabled: true,
    themeNormal: {}, themeReader: {}, githubEnabled: false, githubUsername: '',
    navMenu: [
      { label: '首页', url: '/' },
      { label: '归档', url: '/archive' },
      { label: '友链', url: '/friends' },
      { label: '项目', url: '/projects' },
      { label: 'RSS', url: '/api/rss' },
    ],
```

新增导出：

```ts
export const getProjects = () => get<ProjectsData>('/projects');
```

- [ ] **Step 2: reader.css 字号变量化**

修改 `site/src/styles/themes/reader.css`：

在 `[data-theme='reader']` 块中 `--font-body` 之前加入：

```css
  --font-size: 17px;
```

将 body 规则中的硬编码字号改为变量：

```css
[data-theme='reader'] body {
  background: var(--color-bg);
  color: var(--color-text);
  font-size: var(--font-size);
```

- [ ] **Step 3: BaseLayout 注入主题配置**

修改 `site/src/layouts/BaseLayout.astro` 的 frontmatter，在 `navItems` 之后新增：

```ts
// 后台主题配置 → CSS 变量覆盖（两套都注入，切换主题时同样生效）
function themeStyleBlock(theme: 'normal' | 'reader', cfg: ThemeConfig): string {
  const vars: string[] = [];
  if (cfg.bg) vars.push(`--color-bg:${cfg.bg}`);
  if (cfg.text) vars.push(`--color-text:${cfg.text}`);
  if (cfg.muted) vars.push(`--color-text-muted:${cfg.muted}`);
  if (cfg.primary) vars.push(`--color-primary:${cfg.primary}`);
  if (cfg.border) vars.push(`--color-border:${cfg.border}`);
  if (cfg.fontSize) vars.push(`--font-size:${cfg.fontSize}px`);
  if (!vars.length) return '';
  return `<style>[data-theme='${theme}']{${vars.join(';')}}</style>`;
}
const themeStyle = [themeStyleBlock('normal', settings.themeNormal), themeStyleBlock('reader', settings.themeReader)].join('');
```

在 `<head>` 中（`</head>` 前）注入：

```astro
    <!-- 后台主题配置：覆盖主题 CSS 变量 -->
    <Fragment set:html={themeStyle} />
```

并在 frontmatter 引入 `ThemeConfig` 类型：

```ts
import { getPublicSettings, type ThemeConfig } from '../lib/api';
```

- [ ] **Step 4: 重启前台验证注入**

若前台 dev server 未运行则先启动（后台任务）：

```bash
cd site && npm run dev
```

验证（替换为实际端口 4321）：

```bash
curl -s http://localhost:4321/ | grep -o "data-theme='normal'\|data-theme='reader'"
```

Expected: 输出为空（未配置主题时 `themeStyle` 为空串，属正常）。再通过 Task 2 的接口保存一条配置后重试，Expected: 出现 `<style>[data-theme='reader']{...}</style>`。

- [ ] **Step 5: 提交**

```bash
git add site/src/lib/api.ts site/src/layouts/BaseLayout.astro site/src/styles/themes/reader.css
git commit -m "feat: 前台 SSR 注入主题 CSS 变量，reader 字号变量化"
```

---

### Task 5: 首页文章数读取默认主题配置

**Files:**
- Modify: `site/src/lib/api.ts`
- Modify: `site/src/pages/index.astro`

- [ ] **Step 1: getPosts 支持 pageSize**

修改 `site/src/lib/api.ts` 的 `getPosts`：

```ts
export function getPosts(params: { page?: number; pageSize?: number; category?: string; tag?: string; q?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  if (params.category) qs.set('category', params.category);
  if (params.tag) qs.set('tag', params.tag);
  if (params.q) qs.set('q', params.q);
  return get<Page<PostListItem>>(`/posts?${qs.toString()}`);
}
```

- [ ] **Step 2: index.astro 读取默认主题的 homePageSize**

修改 `site/src/pages/index.astro` 的 frontmatter：

```astro
import { getPosts, getPublicSettings, type PostListItem } from '../lib/api';

const settings = await getPublicSettings();
// 首页文章数：默认主题配置决定（双主题架构下 SSR 以默认主题为准）
const defaultTheme = settings.theme === 'reader' ? settings.themeReader : settings.themeNormal;
const pageSize = defaultTheme.homePageSize ?? 10;
const page = Math.max(1, Number(Astro.url.searchParams.get('page') ?? 1));
const data = await getPosts({ page, pageSize });
```

（`pageSize` 常量替换原 `const pageSize = 10;` 行。）

- [ ] **Step 3: 验证**

保存 `theme_normal` 配置 `{"homePageSize":2}` 后刷新首页：

```bash
curl -s "http://localhost:4321/" | grep -c 'class="item-title"\|class="post-title"'
```

Expected: 每页文章条目数 ≤ 2（与已保存配置一致）。

- [ ] **Step 4: 提交**

```bash
git add site/src/lib/api.ts site/src/pages/index.astro
git commit -m "feat: 首页文章数由默认主题配置控制"
```

---

### Task 6: 前台 /projects 页面

**Files:**
- Create: `site/src/pages/projects.astro`
- Modify: `site/src/styles/themes/reader.css`

- [ ] **Step 1: 创建页面**

创建 `site/src/pages/projects.astro`：

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { getProjects } from '../lib/api';

const data = await getProjects().catch(() => ({ enabled: false, projects: [], error: '加载失败' }));
---
<BaseLayout title="项目">
  <h1 class="page-title">项目</h1>

  {!data.enabled ? (
    <p class="projects-empty">暂未开启 GitHub 项目展示</p>
  ) : data.error ? (
    <div class="projects-empty">
      <p>{data.error}</p>
      <a href={`https://github.com/${data.username}`} target="_blank" rel="noopener noreferrer">访问 GitHub 主页</a>
    </div>
  ) : data.projects.length === 0 ? (
    <p class="projects-empty">该账号暂无公开项目</p>
  ) : (
    <div class="project-list">
      {data.projects.map((p) => (
        <a class="project-card" href={p.url} target="_blank" rel="noopener noreferrer">
          <div class="project-main">
            <span class="project-name">{p.name}</span>
            {p.language && <span class="project-lang">{p.language}</span>}
            {p.stars > 0 && <span class="project-stars">★ {p.stars}</span>}
          </div>
          {p.description && <p class="project-desc">{p.description}</p>}
          <span class="project-updated">{new Date(p.updatedAt).toLocaleDateString('zh-CN')} 更新</span>
        </a>
      ))}
    </div>
  )}
</BaseLayout>

<style is:global>
  .page-title { font-size: 22px; margin-bottom: 20px; max-width: var(--max-width); margin-left: auto; margin-right: auto; }
  .project-list {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px;
    max-width: var(--max-width); margin: 0 auto;
  }
  .project-card {
    display: flex; flex-direction: column; gap: 8px; padding: 16px;
    background: var(--color-surface); border: 1px solid var(--color-border);
    border-radius: var(--radius); box-shadow: var(--shadow);
    text-decoration: none; color: var(--color-text);
  }
  .project-card:hover { border-color: var(--color-primary); }
  .project-main { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .project-name { font-weight: 600; font-size: 16px; }
  .project-lang { font-size: 12px; color: var(--color-primary); border: 1px solid var(--color-border); border-radius: 999px; padding: 1px 8px; }
  .project-stars { font-size: 12px; color: var(--color-text-muted); }
  .project-desc { color: var(--color-text-muted); font-size: 13px; line-height: 1.6; margin: 0; }
  .project-updated { color: var(--color-text-muted); font-size: 12px; opacity: 0.7; }
  .projects-empty { text-align: center; color: var(--color-text-muted); padding: 48px 0; max-width: var(--max-width); margin: 0 auto; }
</style>
```

- [ ] **Step 2: reader 主题 /projects 样式**

在 `site/src/styles/themes/reader.css` 末尾追加：

```css
/* ---------- 项目页：与友链/归档一致的克制列表 ---------- */
[data-theme='reader'] .project-list {
  grid-template-columns: 1fr;
  max-width: 760px;
  gap: 0;
}
[data-theme='reader'] .project-card {
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--color-border);
  border-radius: 0;
  box-shadow: none;
  padding: 18px 4px;
}
[data-theme='reader'] .project-card:hover {
  border-bottom-color: var(--color-primary);
}
[data-theme='reader'] .project-lang {
  border-color: color-mix(in srgb, var(--color-border) 80%, transparent);
  color: var(--color-text-muted);
}
[data-theme='reader'] .project-name {
  font-family: var(--font-body);
  font-weight: 600;
  letter-spacing: 0.02em;
}
```

- [ ] **Step 3: 验证页面可访问**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/projects
```

Expected: 200（未开启 GitHub 时显示「暂未开启」空态）

- [ ] **Step 4: 提交**

```bash
git add site/src/pages/projects.astro site/src/styles/themes/reader.css
git commit -m "feat: 前台项目展示页 /projects（双主题适配）"
```

---

### Task 7: 后台主题管理页

**Files:**
- Create: `admin/src/views/ThemesPage.vue`
- Modify: `admin/src/router/index.ts`
- Modify: `admin/src/views/AdminLayout.vue`

- [ ] **Step 1: 创建 ThemesPage.vue**

创建 `admin/src/views/ThemesPage.vue`：

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { adminGetSettings, adminPutSettings } from '../api/admin';

type ThemeKey = 'normal' | 'reader';
interface ThemeForm {
  bg: string; text: string; muted: string; primary: string; border: string;
  fontSize: number; homePageSize: number;
}
// 与 CSS 内置默认一致的初始值（保存时全量写入，所见即所得）
const DEFAULTS: Record<ThemeKey, ThemeForm> = {
  normal: { bg: '#f5f6f8', text: '#1f2328', muted: '#6b7280', primary: '#3b82f6', border: '#e5e7eb', fontSize: 16, homePageSize: 10 },
  reader: { bg: '#f3f0e9', text: '#2e2c28', muted: '#9a968d', primary: '#5b6b7d', border: '#e7e1d5', fontSize: 17, homePageSize: 10 },
};

const activeTab = ref<ThemeKey>('normal');
const forms = ref<Record<ThemeKey, ThemeForm>>({ normal: { ...DEFAULTS.normal }, reader: { ...DEFAULTS.reader } });
const saved = ref(false);
const error = ref('');
const allSettings = ref<Record<string, string>>({});

function mergeStored(raw: string | undefined, d: ThemeForm): ThemeForm {
  let parsed: Partial<ThemeForm> = {};
  if (raw) {
    try {
      const o = JSON.parse(raw);
      if (o && typeof o === 'object') parsed = o;
    } catch { parsed = {}; }
  }
  return {
    bg: typeof parsed.bg === 'string' && parsed.bg ? parsed.bg : d.bg,
    text: typeof parsed.text === 'string' && parsed.text ? parsed.text : d.text,
    muted: typeof parsed.muted === 'string' && parsed.muted ? parsed.muted : d.muted,
    primary: typeof parsed.primary === 'string' && parsed.primary ? parsed.primary : d.primary,
    border: typeof parsed.border === 'string' && parsed.border ? parsed.border : d.border,
    fontSize: Number.isInteger(parsed.fontSize) ? (parsed.fontSize as number) : d.fontSize,
    homePageSize: Number.isInteger(parsed.homePageSize) ? (parsed.homePageSize as number) : d.homePageSize,
  };
}

onMounted(async () => {
  allSettings.value = await adminGetSettings();
  forms.value.normal = mergeStored(allSettings.value.theme_normal, DEFAULTS.normal);
  forms.value.reader = mergeStored(allSettings.value.theme_reader, DEFAULTS.reader);
});

async function save() {
  saved.value = false;
  error.value = '';
  try {
    allSettings.value.theme_normal = JSON.stringify(forms.value.normal);
    allSettings.value.theme_reader = JSON.stringify(forms.value.reader);
    allSettings.value = await adminPutSettings(allSettings.value);
    saved.value = true;
    setTimeout(() => (saved.value = false), 2000);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败';
  }
}

function resetTheme() {
  forms.value[activeTab.value] = { ...DEFAULTS[activeTab.value] };
}
</script>

<template>
  <div>
    <h1 class="page-title">主题管理</h1>
    <div class="tabs">
      <button type="button" :class="{ active: activeTab === 'normal' }" @click="activeTab = 'normal'">正常主题</button>
      <button type="button" :class="{ active: activeTab === 'reader' }" @click="activeTab = 'reader'">极简阅读</button>
    </div>

    <form class="theme-form" @submit.prevent="save">
      <div class="color-grid">
        <label><span>背景色</span><input type="color" v-model="forms[activeTab].bg" /></label>
        <label><span>正文色</span><input type="color" v-model="forms[activeTab].text" /></label>
        <label><span>次要文字色</span><input type="color" v-model="forms[activeTab].muted" /></label>
        <label><span>主色</span><input type="color" v-model="forms[activeTab].primary" /></label>
        <label><span>边框色</span><input type="color" v-model="forms[activeTab].border" /></label>
      </div>

      <div class="num-row">
        <label>正文字号（px）
          <input type="number" v-model.number="forms[activeTab].fontSize" min="12" max="24" />
        </label>
        <label>首页文章数
          <input type="number" v-model.number="forms[activeTab].homePageSize" min="1" max="50" />
        </label>
      </div>

      <div class="actions">
        <p v-if="saved" class="saved">✓ 已保存</p>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="button" class="btn" @click="resetTheme">恢复当前主题默认</button>
        <button type="submit" class="btn primary">保存主题设置</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.page-title { font-size: 22px; margin-bottom: 20px; }
.tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.tabs button {
  padding: 8px 18px; border: 1px solid #e5e7eb; background: #fff; border-radius: 8px;
  cursor: pointer; font-size: 14px; color: #374151;
}
.tabs button.active { background: #3b82f6; color: #fff; border-color: #3b82f6; }
.theme-form { display: flex; flex-direction: column; gap: 16px; max-width: 560px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; }
.color-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; }
.color-grid label { display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 13px; color: #6b7280; }
.color-grid input[type='color'] { width: 100%; height: 40px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 4px; cursor: pointer; }
.num-row { display: flex; gap: 16px; }
.num-row label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: #6b7280; }
.num-row input { padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px; width: 140px; }
.actions { display: flex; align-items: center; gap: 12px; }
.btn { background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; color: #374151; cursor: pointer; padding: 8px 16px; }
.btn.primary { background: #3b82f6; color: #fff; border: none; padding: 10px 20px; }
.saved { color: #059669; font-size: 14px; }
.error { color: #dc2626; font-size: 14px; }
</style>
```

- [ ] **Step 2: 注册路由**

修改 `admin/src/router/index.ts`，在 `settings` 子路由后追加：

```ts
        { path: 'themes', name: 'admin-themes', component: () => import('../views/ThemesPage.vue') },
```

- [ ] **Step 3: 侧栏导航**

修改 `admin/src/views/AdminLayout.vue`，在「设置」导航项（第 24 行 `<router-link to="/settings">设置</router-link>`）之后追加：

```html
        <router-link to="/themes">主题</router-link>
```

- [ ] **Step 4: 验证**

后台 dev server（5173）运行中时访问 `http://localhost:5173/admin/themes`：
- 两个 Tab 可切换，颜色选择器显示当前值
- 修改背景色并保存 → `curl -s http://localhost:3000/api/admin/settings` 中 `theme_normal` 出现新值（需带 admin token）
- 前台 `http://localhost:4321/` 的 `<head>` 出现对应 `[data-theme='normal']{--color-bg:...}`

- [ ] **Step 5: 提交**

```bash
git add admin/src/views/ThemesPage.vue admin/src/router/index.ts admin/src/views/AdminLayout.vue
git commit -m "feat: 后台主题管理页（双主题外观参数 + 首页文章数）"
```

---

### Task 8: 后台设置页 GitHub fieldset

**Files:**
- Modify: `admin/src/views/SettingsPage.vue`

- [ ] **Step 1: 添加 GitHub 配置区块**

修改 `admin/src/views/SettingsPage.vue`，在「存储」fieldset 之后、「actions」之前插入：

```html
      <fieldset>
        <legend>GitHub 项目展示</legend>
        <label>开启展示
          <select v-model="form.github_enabled">
            <option value="1">开启</option>
            <option value="0">关闭</option>
          </select>
        </label>
        <label>GitHub 用户名
          <input v-model="form.github_username" placeholder="octocat" />
        </label>
        <p class="menu-tip">前台 /projects 页面将自动拉取该账号的公开仓库（不含 fork，按星数排序）。需在导航菜单中添加「项目」链接。</p>
      </fieldset>
```

- [ ] **Step 2: 验证**

- 后台设置页出现 GitHub 区块，可保存用户名与开关
- 保存后 `curl -s http://localhost:4321/projects`（开启后）展示仓库列表或错误提示

- [ ] **Step 3: 提交**

```bash
git add admin/src/views/SettingsPage.vue
git commit -m "feat: 后台设置页新增 GitHub 项目展示配置"
```

---

### Task 9: 端到端验证 + 收尾

**Files:** 无新增

- [ ] **Step 1: 全量后端测试**

```bash
cd backend && npm test
```

Expected: 全部 PASS（含新增 theme-github.test.ts）

- [ ] **Step 2: 全量前台页面回归**

确认三个 dev server（backend :3000 / site :4321 / admin :5173）运行中，浏览器逐一检查：

- 首页：文章数按默认主题配置分页；主题切换（极简/正常）样式均正常、无 FOUC
- `/archive`、`/friends`、`/projects`：双主题下布局正常
- 后台：主题管理页可保存/恢复默认；设置页 GitHub 字段可保存

- [ ] **Step 3: 修复发现的问题并提交**

```bash
git add -A
git commit -m "fix: 端到端验证修复"
```

- [ ] **Step 4: 收尾提交确认**

```bash
git log --oneline -8
```

Expected: 本功能的 8 个 commit 按序排列，工作区干净（`git status` 无未提交改动）
