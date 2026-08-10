# 极简主题重构：仿 blog.7wate.com 中式文人极简 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 将极简（reader）主题全面重构为参考站 blog.7wate.com 的侧栏布局与风格（配色/字体/动效），banner 缩小放入侧栏品牌位，背景色保留管理端配置。

**Architecture:** BaseLayout 同时渲染「顶栏（normal 用，reader 隐藏）」与「侧栏 + 主内容（reader 用，normal 隐藏）」两套结构，CSS 按 `data-theme` 控制显隐；reader.css 全面重写；首页列表改干支纪年 + 时间线；文章页改窄列竖排品牌。

**参照站设计要素**（已抓取分析）：
- 配色：暖米白底 + 暖灰文字 `#3A3837`/`#888580`/`#B0ABA4` + 标题 `#2C2B29` + 边框 `#E5E1DA` + **赭红强调 `#8B3525`**
- 字体：西文 Lora（display）+ EB Garamond（body），中文思源宋体；UI 用系统无衬线
- 首页：干支纪年 sticky 右对齐 + 时间线（左边线 + 圆点标记）+ 日期等宽字体 + 交错上浮动画
- 文章页：窄列竖排品牌名 + 正文 `1.125rem` 细排版（strong 赭红下划线、blockquote 赭红左边线、ul 赭红方块、ol 等宽序号、hr `***`、em 波浪下划线）
- 动效：页面 fadeUp、品牌红点脉冲、顶部滚动进度条、Lenis 平滑滚动（已有）、背景噪点纹理

---

## 任务概览

1. BaseLayout 重构（侧栏双布局 + 字体 + 进度条 + 社交图标）
2. reader.css 全面重写（配色/布局/侧栏/品牌/导航/时间线/文章排版/二级页）
3. index.astro（干支 + 时间线）+ post/[slug].astro（文章布局）改造
4. admin ThemesPage reader 默认值同步
5. 端到端验证 + 提交

---

### Task 1: BaseLayout 重构

**Files:**
- Modify: `site/src/layouts/BaseLayout.astro`

**Step 1: 重写 BaseLayout.astro**

用以下完整内容替换 `site/src/layouts/BaseLayout.astro`：

```astro
---
import '../styles/themes/tokens.css';
import '../styles/themes/normal.css';
import '../styles/themes/reader.css';
import 'highlight.js/styles/github.css';
import ThemeToggle from '../components/ThemeToggle.vue';
import { getPublicSettings, type ThemeConfig } from '../lib/api';

interface Props {
  title?: string;
  description?: string;
  /** full = 侧栏布局（首页/列表页）；article = 窄列竖排品牌（文章页） */
  layout?: 'full' | 'article';
  /** 首页：侧栏品牌位显示 banner 图片 */
  banner?: boolean;
}

const { title = '', description = '', layout = 'full', banner = false } = Astro.props;
// 服务端读取默认主题与导航菜单，直接注入 <html data-theme>，避免闪烁
const settings = await getPublicSettings();
const siteName = settings.siteName || '我的博客';
const defaultTheme = settings.theme || 'normal';
const year = new Date().getFullYear();
// 后台自定义导航菜单（label + url；http 开头外链新窗口打开）
const navItems = (settings.navMenu ?? []).filter((i) => i.label && i.url);
// 当前路径（用于导航高亮）
const path = Astro.url.pathname;
const isActive = (url: string) =>
  url === '/' ? path === '/' : path === url || (url !== '/' && path.startsWith(url));

// 后台主题配置 → CSS 变量覆盖（两套都注入，切换主题时同样生效；:root 提权压制打包 CSS）
function themeStyleBlock(theme: 'normal' | 'reader', cfg: ThemeConfig): string {
  const vars: string[] = [];
  if (cfg.bg) vars.push(`--color-bg:${cfg.bg}`);
  if (cfg.text) vars.push(`--color-text:${cfg.text}`);
  if (cfg.muted) vars.push(`--color-text-muted:${cfg.muted}`);
  if (cfg.primary) vars.push(`--color-primary:${cfg.primary}`);
  if (cfg.border) vars.push(`--color-border:${cfg.border}`);
  if (cfg.fontSize) vars.push(`--font-size:${cfg.fontSize}px`);
  if (!vars.length) return '';
  return `<style>:root[data-theme='${theme}']{${vars.join(';')}}</style>`;
}
const themeStyle = [themeStyleBlock('normal', settings.themeNormal), themeStyleBlock('reader', settings.themeReader)].join('');
---
<!doctype html>
<html lang="zh-CN" data-theme={defaultTheme}>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title ? `${title} · ${siteName}` : siteName}</title>
    <meta name="description" content={description} />
    <!-- 首帧前应用 localStorage 保存的主题，防止刷新时闪现默认（normal）主题 -->
    <script is:inline>
      (function () {
        try {
          var saved = localStorage.getItem('mblog_theme');
          if (saved === 'normal' || saved === 'reader') {
            document.documentElement.setAttribute('data-theme', saved);
          }
        } catch (e) {
          /* localStorage 不可用时忽略 */
        }
      })();
    </script>
    <!-- 思源宋体（中文书卷气）+ Lora/EB Garamond（西文标题/正文）：对齐参考站字体组合 -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400..700;1,400..700&family=EB+Garamond:ital,wght@0,400..700;1,400..700&family=Noto+Serif+SC:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <!-- 后台主题配置：覆盖主题 CSS 变量 -->
    <Fragment set:html={themeStyle} />
  </head>
  <body>
    <!-- 顶部阅读进度条（双主题通用） -->
    <div class="nav-progress" aria-hidden="true"></div>

    <!-- 顶栏导航：normal 主题使用（极简模式通过 CSS 隐藏，改用侧栏导航） -->
    <header class="site-header">
      <div class="inner">
        <nav class="nav">
          {navItems.map((item) =>
            item.url.startsWith('http') ? (
              <a href={item.url} target="_blank" rel="noopener noreferrer">{item.label}</a>
            ) : (
              <a href={item.url}>{item.label}</a>
            ),
          )}
          <ThemeToggle client:load />
        </nav>
      </div>
    </header>

    {layout === 'article' ? (
      <!-- 文章页：窄列竖排品牌 -->
      <div class="page-layout article-layout">
        <aside class="sidebar sidebar-vertical">
          <a class="brand-block" href="/" aria-label="返回首页">
            <span class="brand-name-vertical">{siteName}</span>
          </a>
        </aside>
        <main class="site-main"><slot /></main>
      </div>
    ) : (
      <div class="page-layout">
        <aside class="sidebar">
          <header class="brand-area">
            {banner ? (
              <a class="brand-banner" href="/" aria-label="首页"><img src="/banner.png" alt={siteName} /></a>
            ) : (
              <h1 class="brand-name"><a href="/">{siteName}</a><span class="brand-mark" aria-hidden="true"></span></h1>
            )}
            {settings.siteDesc && <p class="bio">{settings.siteDesc}</p>}
          </header>
          <nav class="site-nav">
            {navItems.map((item) =>
              item.url.startsWith('http') ? (
                <a href={item.url} target="_blank" rel="noopener noreferrer">{item.label}</a>
              ) : (
                <a href={item.url} class={isActive(item.url) ? 'active' : ''} aria-current={isActive(item.url) ? 'page' : undefined}>
                  {item.label}
                </a>
              ),
            )}
          </nav>
          <footer class="sidebar-footer">
            {settings.githubUsername && (
              <a class="social-icon" href={`https://github.com/${settings.githubUsername}`} target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.87-1.54-3.87-1.54-.53-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.33.95.1-.74.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12v3.14c0 .31.21.67.8.56A10.52 10.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/></svg>
              </a>
            )}
            <a class="social-icon" href="/api/rss" aria-label="RSS 订阅">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.18 15.64a2.18 2.18 0 1 1 0 4.36 2.18 2.18 0 0 1 0-4.36zM4 4.44v3.06c7.05 0 12.5 5.45 12.5 12.5h3.06C19.56 10.84 13.16 4.44 4 4.44zM4 10.1v3.06c3.88 0 6.84 2.96 6.84 6.84h3.06c0-5.47-4.43-9.9-9.9-9.9z"/></svg>
            </a>
            <ThemeToggle client:load />
          </footer>
        </aside>
        <main class="site-main"><slot /></main>
      </div>
    )}

    <footer class="site-footer">
      <span class="site-footer-text">© {year} {siteName}</span>
      <span class="footer-right">Powered by MBLOG</span>
    </footer>
    <script>
      import '../scripts/lenis.ts';
    </script>
    <script is:inline>
      // 顶部阅读进度条
      (function () {
        var bar = document.querySelector('.nav-progress');
        if (!bar) return;
        function update() {
          var h = document.documentElement;
          var max = h.scrollHeight - h.clientHeight;
          bar.style.width = (max > 0 ? Math.min(1, h.scrollTop / max) * 100 : 0) + '%';
        }
        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        update();
      })();
    </script>
  </body>
</html>

<style is:global>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: var(--font-body);
    font-size: var(--font-size);
    line-height: var(--line-height);
    -webkit-font-smoothing: antialiased;
  }
  a { color: var(--color-primary); }
  /* 顶部阅读进度条 */
  .nav-progress {
    position: fixed; top: 0; left: 0; width: 0; height: 2px;
    background: var(--color-primary);
    z-index: 9998; pointer-events: none;
    transition: width 0.1s linear;
  }
  /* 顶栏（normal 主题） */
  .site-header { background: var(--color-surface); border-bottom: 1px solid var(--color-border); }
  .inner {
    max-width: var(--max-width);
    margin: 0 auto;
    padding: 0 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 56px;
  }
  .nav { display: flex; gap: 16px; align-items: center; }
  .nav a { color: var(--color-text-muted); text-decoration: none; font-size: 14px; }
  .nav a:hover { color: var(--color-primary); }
  .site-main { min-width: 0; min-height: calc(100vh - 120px); }
  .site-footer {
    border-top: 1px solid var(--color-border);
    padding: 20px;
    display: flex;
    justify-content: space-between;
    color: var(--color-text-muted);
    font-size: 14px;
    max-width: var(--max-width);
    margin: 0 auto;
  }
  /* markdown 正文基础 */
  .markdown-body { line-height: var(--line-height); word-break: break-word; }
  .markdown-body h1, .markdown-body h2, .markdown-body h3 { margin: 1.4em 0 0.6em; line-height: 1.4; }
  .markdown-body p { margin: 0.8em 0; }
  .markdown-body code { background: var(--color-code-bg); border-radius: 4px; padding: 2px 5px; font-family: var(--font-mono); font-size: 0.9em; }
  .markdown-body pre { background: var(--color-code-bg); padding: 16px; border-radius: var(--radius); overflow-x: auto; }
  .markdown-body pre code { background: transparent; padding: 0; }
  .markdown-body img { max-width: 100%; border-radius: var(--radius); }
  .markdown-body audio { max-width: 100%; margin: 0.8em 0; }
  .markdown-body blockquote { margin: 0.8em 0; padding-left: 14px; border-left: 3px solid var(--color-border); color: var(--color-text-muted); }
  .markdown-body table { border-collapse: collapse; margin: 0.8em 0; width: 100%; }
  .markdown-body th, .markdown-body td { border: 1px solid var(--color-border); padding: 8px 12px; }
  /* 文章列表卡片（normal 主题） */
  .post-list { display: flex; flex-direction: column; gap: 16px; }
  .post-card { padding: var(--card-padding); }
  .post-card .post-title { margin: 0 0 8px; font-size: 20px; }
  .post-card .post-title a { color: var(--color-text); text-decoration: none; }
  .post-card .post-title a:hover { color: var(--color-primary); }
  .post-card .post-summary { color: var(--color-text-muted); margin: 0 0 12px; font-size: 14px; line-height: 1.6; }
  .post-meta { display: flex; gap: 16px; flex-wrap: wrap; color: var(--color-text-muted); font-size: 13px; align-items: center; }
  .post-empty { text-align: center; color: var(--color-text-muted); padding: 48px 0; }
</style>
```

**Step 2: 验证编译**

Run: `cd E:/zcodework/MBLOG/site && npx astro check`
Expected: 0 errors（3 个既有 hint 可忽略）。

**Step 3: 提交**

```bash
git add site/src/layouts/BaseLayout.astro
git commit -m "feat: BaseLayout 重构——侧栏双布局（full/article）、字体组合、阅读进度条、社交图标"
```

---

### Task 2: reader.css 全面重写

**Files:**
- Rewrite: `site/src/styles/themes/reader.css`

**Step 1: 重写 reader.css**

用以下完整内容**整体替换** `site/src/styles/themes/reader.css`（删掉旧文件内容，写入新内容）：

```css
/* =========================================================
   极简主题：仿 blog.7wate.com 中式文人极简
   布局：左侧栏（品牌/简介/导航/社交）+ 主内容；文章页窄列竖排品牌
   配色：暖米白底 + 暖灰文字 + 赭红强调（背景色保留后台设置默认）
   ========================================================= */

[data-theme='reader'] {
  --color-bg: rgb(243, 240, 233);
  --color-surface: transparent;
  --color-text: #3a3837;
  --color-text-muted: #b0aba4;
  --color-primary: #8b3525;
  --color-primary-contrast: #ffffff;
  --color-border: #e5e1da;
  --color-code-bg: #f0ede7;
  --color-text-secondary: #888580;
  --color-text-heading: #2c2b29;
  --color-border-strong: #c8c3ba;
  --radius: 2px;
  --max-width: 1200px;
  --shadow: none;
  --font-size: 17px;
  --font-display: 'Lora', 'Noto Serif SC', 'Source Han Serif SC', 'Source Han Serif CN',
    'Songti SC', 'Noto Serif CJK SC', 'SimSun', serif;
  --font-body: 'EB Garamond', 'Noto Serif SC', 'Source Han Serif SC', 'Source Han Serif CN',
    'Songti SC', 'Noto Serif CJK SC', 'SimSun', serif;
  --font-ui: system-ui, -apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace;
}

/* ---------- 页面基础 ---------- */
[data-theme='reader'] body {
  background-color: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--font-size);
  line-height: 1.7;
  letter-spacing: 0.01em;
  /* 轻微噪点纹理（仿参考站） */
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
  background-blend-mode: multiply;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
[data-theme='reader'] a {
  color: var(--color-primary);
  text-underline-offset: 4px;
  transition: color 0.18s ease;
}
/* 顶栏（normal 用）在极简模式隐藏 */
[data-theme='reader'] .site-header {
  display: none;
}

/* ---------- 动效 ---------- */
@keyframes readerFadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes readerFadeUpStagger {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes readerPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ---------- 侧栏布局 ---------- */
[data-theme='reader'] .page-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 96px;
  max-width: 1200px;
  margin: 0 auto;
  padding: 96px clamp(24px, 6vw, 72px);
  min-height: 100vh;
  animation: readerFadeUp 0.42s cubic-bezier(0, 0, 0.2, 1) forwards;
}
[data-theme='reader'] .site-main {
  padding-bottom: 96px;
}
[data-theme='reader'] .sidebar {
  position: sticky;
  top: 96px;
  height: fit-content;
  min-height: calc(61.8vh - 96px);
  display: flex;
  flex-direction: column;
  gap: 48px;
}

/* 品牌区：首页 = banner；其余页 = 站名 + 呼吸红点 */
[data-theme='reader'] .brand-area .brand-name {
  font-family: var(--font-display);
  font-size: 3rem;
  font-weight: 700;
  color: var(--color-text-heading);
  letter-spacing: 0.1em;
  line-height: 1.25;
  display: flex;
  align-items: baseline;
  margin-bottom: 24px;
}
[data-theme='reader'] .brand-area .brand-name a {
  color: inherit;
  text-decoration: none;
}
[data-theme='reader'] .brand-mark {
  display: inline-block;
  width: 8px;
  height: 8px;
  background-color: var(--color-primary);
  margin-left: 4px;
  flex-shrink: 0;
  animation: readerPulse 4s ease-in-out infinite;
}
[data-theme='reader'] .brand-banner {
  display: block;
  margin-bottom: 24px;
}
[data-theme='reader'] .brand-banner img {
  display: block;
  width: 100%;
  max-width: 240px;
  height: auto;
  border-radius: 2px;
}
[data-theme='reader'] .bio {
  font-size: 1rem;
  color: var(--color-text-secondary);
  line-height: 1.85;
  white-space: normal;
}

/* 侧栏导航：竖排 + 「—」悬停标记 */
[data-theme='reader'] .site-nav {
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-family: var(--font-ui);
  font-size: 0.833rem;
  letter-spacing: 0.15em;
}
[data-theme='reader'] .site-nav a {
  color: var(--color-text-secondary);
  display: inline-flex;
  align-items: center;
  width: fit-content;
  text-decoration: none;
}
[data-theme='reader'] .site-nav a::before {
  content: '—';
  margin-right: 8px;
  color: transparent;
  transition: color 0.18s ease;
}
[data-theme='reader'] .site-nav a:hover,
[data-theme='reader'] .site-nav a.active {
  color: var(--color-text-primary);
}
[data-theme='reader'] .site-nav a.active::before,
[data-theme='reader'] .site-nav a:hover::before {
  color: var(--color-primary);
}

/* 侧栏底部：社交图标 + 主题切换 */
[data-theme='reader'] .sidebar-footer {
  margin-top: auto;
  display: flex;
  flex-direction: row;
  gap: 20px;
  align-items: center;
}
[data-theme='reader'] .social-icon {
  color: var(--color-text-muted);
  display: inline-flex;
  transition: color 0.18s ease, transform 0.18s ease;
}
[data-theme='reader'] .social-icon:hover {
  color: var(--color-text-secondary);
  transform: translateY(-2px);
}
[data-theme='reader'] .sidebar-footer .theme-toggle {
  margin-left: auto;
  border: none;
  background: transparent;
  padding: 0;
  color: var(--color-text-muted);
  font-family: var(--font-ui);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  opacity: 0.8;
  cursor: pointer;
  transition: color 0.18s ease, opacity 0.18s ease;
}
[data-theme='reader'] .sidebar-footer .theme-toggle:hover {
  color: var(--color-text);
  opacity: 1;
}

/* 页脚 */
[data-theme='reader'] .site-footer {
  border-top: none;
  text-align: center;
  padding: 96px 16px 32px;
  max-width: 1200px;
  font-family: var(--font-ui);
  font-size: 0.694rem;
  color: var(--color-text-muted);
  letter-spacing: 0.05em;
}
[data-theme='reader'] .site-footer .footer-right {
  display: none;
}

/* ---------- 首页：干支年份 + 时间线列表 ---------- */
[data-theme='reader'] .content-stream {
  display: flex;
  flex-direction: column;
  gap: 96px;
  padding-top: 8px;
}
[data-theme='reader'] .year-group {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 24px;
  position: relative;
}
[data-theme='reader'] .year-label {
  font-family: var(--font-ui);
  font-size: 1.5rem;
  font-weight: 400;
  color: var(--color-text-muted);
  position: sticky;
  top: 96px;
  height: fit-content;
  text-align: right;
  padding-right: 16px;
  padding-top: 24px;
  letter-spacing: 0.15em;
  margin: 0;
}
[data-theme='reader'] .year-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--color-border);
}
[data-theme='reader'] .year-item {
  display: block;
  padding: 24px 0 24px 32px;
  position: relative;
  opacity: 0;
  transform: translateY(12px);
  animation: readerFadeUpStagger 0.5s cubic-bezier(0, 0, 0.2, 1) forwards;
}
[data-theme='reader'] .year-item:nth-child(1) { animation-delay: 60ms; }
[data-theme='reader'] .year-item:nth-child(2) { animation-delay: 120ms; }
[data-theme='reader'] .year-item:nth-child(3) { animation-delay: 180ms; }
[data-theme='reader'] .year-item:nth-child(4) { animation-delay: 240ms; }
[data-theme='reader'] .year-item:nth-child(5) { animation-delay: 300ms; }
[data-theme='reader'] .year-item:nth-child(6) { animation-delay: 360ms; }
[data-theme='reader'] .year-item:nth-child(7) { animation-delay: 420ms; }
[data-theme='reader'] .year-item:nth-child(8) { animation-delay: 480ms; }
[data-theme='reader'] .year-item::before {
  content: '';
  position: absolute;
  left: -3px;
  top: 32px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background-color: var(--color-border-strong);
  transition: background-color 0.18s ease;
}
[data-theme='reader'] .year-item:hover::before {
  background-color: var(--color-primary);
}
[data-theme='reader'] .year-item .item-main {
  display: block;
}
[data-theme='reader'] .year-item .item-date {
  display: block;
  font-family: var(--font-mono);
  font-size: 0.833rem;
  color: var(--color-text-secondary);
  letter-spacing: 0.1em;
  font-variant-numeric: tabular-nums;
  margin-bottom: 8px;
  opacity: 1;
}
[data-theme='reader'] .year-item .item-title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 1.5rem;
  font-weight: 400;
  color: var(--color-text-primary);
  line-height: 1.45;
  text-decoration: none;
  transition: color 0.18s ease;
}
[data-theme='reader'] .year-item:hover .item-title {
  color: var(--color-primary);
}
[data-theme='reader'] .item-summary,
[data-theme='reader'] .item-views {
  display: none;
}

/* 分页 */
[data-theme='reader'] .pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 96px;
  padding-top: 32px;
  border-top: 1px solid var(--color-border);
  font-family: var(--font-ui);
  font-size: 0.833rem;
  letter-spacing: 0.15em;
}
[data-theme='reader'] .pagination a {
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: color 0.18s ease;
}
[data-theme='reader'] .pagination a:hover {
  color: var(--color-primary);
}
[data-theme='reader'] .page-info {
  color: var(--color-text-muted);
}

/* ---------- 文章页：窄列竖排品牌 + 正文排版 ---------- */
[data-theme='reader'] .page-layout.article-layout {
  grid-template-columns: clamp(56px, 8vw, 96px) 1fr;
  gap: 40px;
  padding: 96px clamp(20px, 4vw, 56px);
  max-width: 1200px;
}
[data-theme='reader'] .sidebar-vertical {
  position: sticky;
  top: 96px;
  min-height: 0;
  gap: 0;
  padding-left: 4px;
}
[data-theme='reader'] .brand-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--color-text-heading);
  transition: color 0.18s ease;
}
[data-theme='reader'] .brand-block:hover {
  color: var(--color-text-primary);
}
[data-theme='reader'] .brand-name-vertical {
  writing-mode: vertical-rl;
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  line-height: 1;
  color: inherit;
}
[data-theme='reader'] .article-wrapper {
  min-width: 0;
  width: clamp(580px, 62vw, 720px);
  max-width: 100%;
  margin: 0 auto;
}
[data-theme='reader'] .article-title {
  font-family: var(--font-display);
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 700;
  color: var(--color-text-heading);
  line-height: 1.25;
  margin: 0 0 24px;
  letter-spacing: -0.02em;
}
[data-theme='reader'] .article-meta {
  font-family: var(--font-mono);
  font-size: 0.833rem;
  color: var(--color-text-secondary);
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  font-variant-numeric: tabular-nums;
  margin-bottom: 48px;
}
[data-theme='reader'] .article-meta > *:not(:last-child)::after {
  content: '·';
  margin-left: 8px;
  color: var(--color-border-strong);
}
[data-theme='reader'] .article-meta a {
  color: var(--color-text-secondary);
  text-decoration: none;
}
[data-theme='reader'] .article-meta a:hover {
  color: var(--color-primary);
}
[data-theme='reader'] .article-content {
  font-size: 1.125rem;
  line-height: 1.85;
  word-break: break-word;
  font-variant-numeric: tabular-nums;
}
[data-theme='reader'] .article-content p {
  line-height: 1.75;
  margin: 0 0 12px;
}
[data-theme='reader'] .article-content strong {
  font-weight: inherit;
  color: inherit;
  text-decoration: underline;
  text-decoration-color: var(--color-primary);
  text-decoration-thickness: 1.5px;
  text-underline-offset: 0.25em;
  text-decoration-skip-ink: none;
}
[data-theme='reader'] .article-content h2 {
  font-family: var(--font-display);
  font-size: 1.875rem;
  font-weight: 700;
  color: var(--color-text-heading);
  margin-top: 64px;
  margin-bottom: 24px;
  line-height: 1.45;
}
[data-theme='reader'] .article-content h3 {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text-heading);
  margin-top: 48px;
  margin-bottom: 16px;
  line-height: 1.45;
}
[data-theme='reader'] .article-content blockquote {
  border-left: 2px solid var(--color-primary);
  background: var(--color-code-bg);
  padding: 16px 24px;
  margin: 32px 0;
  color: var(--color-text-secondary);
  line-height: 1.85;
  font-style: normal;
}
[data-theme='reader'] .article-content blockquote p {
  margin-bottom: 0;
}
[data-theme='reader'] .article-content ul {
  list-style: none;
  padding-left: 0;
  margin-bottom: 20px;
}
[data-theme='reader'] .article-content ul > li {
  position: relative;
  padding-left: 1.4em;
  margin-bottom: 8px;
}
[data-theme='reader'] .article-content ul > li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.8em;
  width: 6px;
  height: 6px;
  background-color: var(--color-primary);
}
[data-theme='reader'] .article-content ol {
  list-style: none;
  counter-reset: reader-ol;
  padding-left: 0;
  margin-bottom: 20px;
}
[data-theme='reader'] .article-content ol > li {
  counter-increment: reader-ol;
  position: relative;
  padding-left: 2.2em;
  margin-bottom: 8px;
}
[data-theme='reader'] .article-content ol > li::before {
  content: counter(reader-ol, decimal-leading-zero) '.';
  position: absolute;
  left: 0;
  top: 0.1em;
  font-family: var(--font-mono);
  font-size: 0.85em;
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}
[data-theme='reader'] .article-content code {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: var(--color-code-bg);
  padding: 2px 6px;
  border-radius: 3px;
}
[data-theme='reader'] .article-content pre {
  background: var(--color-code-bg);
  border-left: 3px solid var(--color-border-strong);
  padding: 16px;
  overflow-x: auto;
  margin: 32px 0;
}
[data-theme='reader'] .article-content pre code {
  background: none;
  padding: 0;
  border-radius: 0;
  font-size: 0.833rem;
  line-height: 1.6;
}
[data-theme='reader'] .article-content a {
  color: var(--color-text-primary);
  text-decoration: underline;
  text-decoration-color: var(--color-border-strong);
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
  transition: color 0.18s ease, text-decoration-color 0.18s ease;
}
[data-theme='reader'] .article-content a:hover {
  color: var(--color-primary);
  text-decoration-color: var(--color-primary);
}
[data-theme='reader'] .article-content em {
  font-style: normal;
  text-decoration: underline wavy;
  text-decoration-color: var(--color-text-secondary);
  text-decoration-thickness: 1.25px;
  text-underline-offset: 0.2em;
}
[data-theme='reader'] .article-content del {
  text-decoration: line-through;
  text-decoration-color: var(--color-border-strong);
  text-decoration-thickness: 1.25px;
  color: var(--color-text-muted);
}
[data-theme='reader'] .article-content hr {
  border: none;
  text-align: center;
  margin: 64px 0;
}
[data-theme='reader'] .article-content hr::after {
  content: '***';
  font-family: var(--font-display);
  font-size: 1.5rem;
  color: var(--color-border-strong);
  letter-spacing: 0.5em;
}
[data-theme='reader'] .article-content img {
  width: 100%;
  height: auto;
  display: block;
  margin: 32px 0;
}
[data-theme='reader'] .article-content table {
  width: 100%;
  border-collapse: collapse;
  margin: 24px 0 32px;
  font-size: 0.833rem;
  border: 1px solid var(--color-border);
}
[data-theme='reader'] .article-content thead {
  border-bottom: 2px solid var(--color-border-strong);
}
[data-theme='reader'] .article-content th,
[data-theme='reader'] .article-content td {
  padding: 12px 16px;
  border: 1px solid var(--color-border);
  text-align: left;
  vertical-align: top;
}
[data-theme='reader'] .article-content th {
  font-family: var(--font-ui);
  font-weight: 600;
  color: var(--color-text-heading);
  background: var(--color-code-bg);
}
[data-theme='reader'] .article-content tbody tr:nth-child(even) {
  background: var(--color-code-bg);
}
[data-theme='reader'] .article-footer {
  margin-top: 96px;
  padding-top: 48px;
  border-top: 1px solid var(--color-border);
}
[data-theme='reader'] .tags {
  list-style: none;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin: 0 0 48px;
  padding: 0;
}
[data-theme='reader'] .tag {
  font-family: var(--font-ui);
  font-size: 0.694rem;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  padding: 4px 12px;
  border-radius: 2px;
  letter-spacing: 0.15em;
  text-decoration: none;
  transition: color 0.18s ease, border-color 0.18s ease;
}
[data-theme='reader'] .tag:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

/* ---------- 二级页面（归档/友链/项目/搜索/分类/标签） ---------- */
[data-theme='reader'] .page-title {
  font-family: var(--font-display);
  font-size: 2.25rem;
  font-weight: 700;
  color: var(--color-text-heading);
  letter-spacing: 0.02em;
  margin: 0 auto 40px;
  max-width: 760px;
}
[data-theme='reader'] .archive-group {
  max-width: 760px;
  margin: 0 auto;
}
[data-theme='reader'] .archive-group .month {
  font-family: var(--font-ui);
  font-size: 0.833rem;
  font-weight: 400;
  color: var(--color-text-muted);
  letter-spacing: 0.2em;
  border-bottom: none;
  padding: 40px 0 8px;
  margin: 0;
}
[data-theme='reader'] .archive-group ul {
  margin: 0;
  padding: 0;
  list-style: none;
  border-left: 1px solid var(--color-border);
}
[data-theme='reader'] .archive-group li {
  padding: 14px 0 14px 24px;
  position: relative;
}
[data-theme='reader'] .archive-group li::before {
  content: '';
  position: absolute;
  left: -3px;
  top: 22px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background-color: var(--color-border-strong);
}
[data-theme='reader'] .archive-group .date {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  min-width: 96px;
  opacity: 0.8;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.08em;
}
[data-theme='reader'] .archive-group a {
  color: var(--color-text-primary);
  font-size: 1.125rem;
  text-decoration: none;
}
[data-theme='reader'] .archive-group a:hover {
  color: var(--color-primary);
}
[data-theme='reader'] .link-grid {
  grid-template-columns: 1fr;
  max-width: 760px;
  gap: 0;
}
[data-theme='reader'] .link-card {
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--color-border);
  border-radius: 0;
  box-shadow: none;
  padding: 16px 4px;
}
[data-theme='reader'] .link-card:hover {
  border-bottom-color: var(--color-primary);
}
[data-theme='reader'] .link-avatar {
  width: 36px;
  height: 36px;
  background: transparent;
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  font-size: 15px;
  font-family: var(--font-display);
}
[data-theme='reader'] .link-name {
  font-weight: 500;
  font-family: var(--font-display);
}
[data-theme='reader'] .link-desc {
  font-size: 13px;
  opacity: 0.75;
}
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
[data-theme='reader'] .project-name {
  font-family: var(--font-display);
  font-weight: 600;
  letter-spacing: 0.02em;
}
[data-theme='reader'] .project-lang {
  border-color: var(--color-border);
  color: var(--color-text-muted);
}
[data-theme='reader'] .search-form {
  max-width: 760px;
  gap: 12px;
}
[data-theme='reader'] .search-form input {
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--color-border);
  border-radius: 0;
  padding: 8px 2px;
  font-family: inherit;
  font-size: 1rem;
  color: var(--color-text);
  outline: none;
  transition: border-color 0.18s ease;
}
[data-theme='reader'] .search-form input:focus {
  border-bottom-color: var(--color-text-muted);
}
[data-theme='reader'] .search-form button {
  background: transparent;
  border: 0;
  border-radius: 0;
  color: var(--color-text-muted);
  font-size: 0.833rem;
  letter-spacing: 0.15em;
  padding: 0 8px;
  cursor: pointer;
  transition: color 0.18s ease;
}
[data-theme='reader'] .search-form button:hover {
  color: var(--color-text);
}
[data-theme='reader'] .result-info {
  max-width: 760px;
  font-family: var(--font-ui);
  color: var(--color-text-muted);
}
[data-theme='reader'] .post-card {
  background: transparent;
  border-bottom: 1px solid var(--color-border);
  border-radius: 0;
  box-shadow: none;
  padding: 32px 0;
}
[data-theme='reader'] .post-card .post-title {
  font-family: var(--font-display);
  font-size: 1.5rem;
}
[data-theme='reader'] .post-views {
  display: none;
}
[data-theme='reader'] .projects-empty,
[data-theme='reader'] .link-empty,
[data-theme='reader'] .post-empty {
  text-align: center;
  color: var(--color-text-muted);
  padding: 64px 0;
  font-family: var(--font-ui);
  font-size: 0.833rem;
  letter-spacing: 0.15em;
}

/* ---------- 评论区 ---------- */
[data-theme='reader'] .comment-section {
  border-top: 1px solid var(--color-border);
  margin-top: 64px;
  padding-top: 32px;
}
```

**Step 2: 验证编译**

Run: `cd E:/zcodework/MBLOG/site && npx astro check`
Expected: 0 errors。

**Step 3: 提交**

```bash
git add site/src/styles/themes/reader.css
git commit -m "feat: 极简主题全面重写——侧栏布局/赭红配色/干支时间线/参考站文章排版"
```

---

### Task 3: 首页与文章页改造

**Files:**
- Modify: `site/src/pages/index.astro`
- Modify: `site/src/pages/post/[slug].astro`

**Step 1: index.astro**

用以下完整内容替换 `site/src/pages/index.astro`：

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { getPosts, getPublicSettings, type PostListItem } from '../lib/api';

const settings = await getPublicSettings();
// 首页文章数：默认主题配置决定（双主题架构下 SSR 以默认主题为准）
const defaultTheme = settings.theme === 'reader' ? settings.themeReader : settings.themeNormal;
const pageSize = defaultTheme.homePageSize ?? 10;
const page = Math.max(1, Number(Astro.url.searchParams.get('page') ?? 1));
const data = await getPosts({ page, pageSize });
const total = data.total;
const totalPages = Math.max(1, Math.ceil(total / pageSize));

// 干支纪年：2026 -> 丙午（天干地支按年份取模）
const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
function yearGanzhi(year: number): string {
  return GAN[(year - 4) % 10] + ZHI[(year - 4) % 12];
}
// 按年份分组（最新在前）
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
---
<BaseLayout description={settings.siteDesc} banner>
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
</BaseLayout>

<style is:global>
  /* 分页默认样式（normal 主题） */
  .pagination {
    display: flex; gap: 16px; align-items: center; justify-content: center;
    padding: 24px 0; max-width: var(--max-width); margin: 0 auto;
  }
  .pagination a { color: var(--color-text); text-decoration: none; border: 1px solid var(--color-border); border-radius: var(--radius); padding: 6px 14px; background: var(--color-surface); }
  .pagination a:hover { color: var(--color-primary); border-color: var(--color-primary); }
  .page-info { color: var(--color-text-muted); font-size: 14px; }
</style>
```

**Step 2: post/[slug].astro**

用以下完整内容替换 `site/src/pages/post/[slug].astro`：

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import CommentSection from '../../components/CommentSection.vue';
import { getPost } from '../../lib/api';

const { slug } = Astro.params;
let post;
try {
  post = await getPost(slug!);
} catch {
  return Astro.redirect('/404');
}
---
<BaseLayout title={post.title} description={post.summary} layout="article">
  <article class="article-wrapper">
    <header class="article-header">
      <h1 class="article-title">{post.title}</h1>
      <div class="article-meta">
        {post.category && <a href={`/category/${post.category.slug}`}>{post.category.name}</a>}
        <time>{new Date(post.createdAt).toLocaleDateString('zh-CN')}</time>
        <span>{post.viewCount} 次阅读</span>
      </div>
    </header>
    {/* 后端已渲染并防 XSS 的 HTML */}
    <div class="article-content markdown-body" set:html={post.contentHtml} />
    {post.tags.length > 0 && (
      <footer class="article-footer">
        <ul class="tags">
          {post.tags.map((t) => (
            <li><a class="tag" href={`/tag/${t.slug}`}>{t.name}</a></li>
          ))}
        </ul>
      </footer>
    )}
    <CommentSection client:load postId={post.id} />
  </article>
</BaseLayout>
```

（原 `<style>` 块删除——样式全部由 reader.css 的 `.article-*` 规则与 normal 主题兜底提供。）

**Step 3: 验证编译**

Run: `cd E:/zcodework/MBLOG/site && npx astro check`
Expected: 0 errors。

**Step 4: 提交**

```bash
git add site/src/pages/index.astro site/src/pages/post/[slug].astro
git commit -m "feat: 首页干支纪年时间线 + 文章页参考站布局"
```

---

### Task 4: 后台主题默认值同步

**Files:**
- Modify: `admin/src/views/ThemesPage.vue`

**Step 1: 更新 reader 默认值**

在 `admin/src/views/ThemesPage.vue` 中，将 `DEFAULTS` 常量改为：

```ts
const DEFAULTS: Record<ThemeKey, ThemeForm> = {
  normal: { bg: '#f5f6f8', text: '#1f2328', muted: '#6b7280', primary: '#3b82f6', border: '#e5e7eb', fontSize: 16, homePageSize: 10 },
  reader: { bg: '#f3f0e9', text: '#3a3837', muted: '#b0aba4', primary: '#8b3525', border: '#e5e1da', fontSize: 17, homePageSize: 10 },
};
```

**Step 2: 验证**

Run: `cd E:/zcodework/MBLOG/admin && npm run typecheck`
Expected: 0 errors。

**Step 3: 提交**

```bash
git add admin/src/views/ThemesPage.vue
git commit -m "fix: 主题管理极简模式默认值同步新配色"
```

---

### Task 5: 端到端验证 + 收尾

**Files:** 无新增

**Step 1: 全站回归**

浏览器逐页检查（dev：backend :3000 / site :4321 / admin :5173）：

- 首页：侧栏（banner 缩小 + 简介 + 导航「—」标记 + GitHub/RSS 图标 + 主题切换），主区干支年份 + 时间线 + 交错动画 + 阅读进度条
- 主题切换：normal 顶栏布局不受影响；切回 reader 正常
- 文章页：窄列竖排品牌名 + 文章排版（strong 下划线、blockquote、列表、代码块）
- 归档/友链/项目/搜索/分类/标签页：侧栏一致、列表风格统一
- 后台主题管理：极简 Tab 显示新默认色；保存背景色后前台生效（背景保留用户设置）

**Step 2: 修复发现的问题并提交**

```bash
git add -A
git commit -m "fix: 极简主题重构端到端修复"
```

**Step 3: 收尾确认**

```bash
git status --short   # 期望空
git log --oneline -8
```
