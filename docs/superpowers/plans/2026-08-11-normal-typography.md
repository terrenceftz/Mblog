# 正常主题全站字体方案（Playfair 高对比衬线）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为正常主题建立「Playfair Display + 思源宋体衬线标题 / 系统无衬线正文 / JetBrains Mono 等宽数字」的全站字体层级，并在首页最新文章区块加入指向 `/archive` 的「查看全部文章 →」入口。

**Architecture:** 纯前端静态改动，零后端。字体通过 BaseLayout 的 Google Fonts 链接加载；字体栈与层级全部写在 `site/src/styles/themes/normal.css` 的 `[data-theme='normal']` 前缀下，极简主题（reader.css / Lora / EB Garamond / Noto Serif SC）零改动。首页链接是 index.astro 内的一行标签 + 一条居中 flex 样式。

**Tech Stack:** Astro SSR（.astro）、CSS 变量 + `[data-theme]` 前缀隔离、Google Fonts。

参考设计文档：`docs/superpowers/specs/2026-08-11-normal-typography-design.md`

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `site/src/layouts/BaseLayout.astro:68-71` | Google Fonts 链接：新增 Playfair Display + JetBrains Mono |
| `site/src/styles/themes/normal.css` | 字体栈（`--font-display`/`--font-mono`）+ 全站字体层级规则（仅 normal 主题） |
| `site/src/pages/index.astro:113` | 最新文章区块头新增「查看全部文章 →」链接 |
| `.gitignore` | 忽略 `.superpowers/`（视觉伴侣会话产物） |

---

### Task 1: 加载 Playfair Display + JetBrains Mono 字体

**Files:**
- Modify: `site/src/layouts/BaseLayout.astro:68-71`
- Modify: `.gitignore`

- [ ] **Step 1: 修改 Google Fonts 链接**

将 `site/src/layouts/BaseLayout.astro` 第 68-71 行的 `<link>` 替换为（在末尾追加两个字体族）：

```html
    <link
      href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400..700;1,400..700&family=EB+Garamond:ital,wght@0,400..700;1,400..700&family=Noto+Serif+SC:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,500..800;1,500..700&family=JetBrains+Mono:wght@400;500;600&display=swap"
      rel="stylesheet"
    />
```

- [ ] **Step 2: .gitignore 忽略视觉伴侣会话目录**

在 `.gitignore` 末尾追加一行：

```
.superpowers/
```

- [ ] **Step 3: 验证字体链接已下发**

Run: `curl -s http://localhost:4321/ | grep -o 'Playfair+Display' | head -1`
Expected: 输出 `Playfair+Display`（说明链接已进入 SSR HTML）。

- [ ] **Step 4: 提交**

```bash
git add site/src/layouts/BaseLayout.astro .gitignore
git commit -m "feat(site): 加载 Playfair Display 与 JetBrains Mono 字体（正常主题）"
```

---

### Task 2: 正常主题字体栈与全站字体层级

**Files:**
- Modify: `site/src/styles/themes/normal.css`

- [ ] **Step 1: 替换字体栈变量**

将 `normal.css` 第 23-25 行的三个变量替换为（新增 `--font-display` 衬线栈与 `--font-mono` 覆盖，body/ui 保持不变）：

```css
  --font-body: system-ui, -apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', sans-serif;
  --font-display: 'Playfair Display', 'Noto Serif SC', 'Source Han Serif SC', 'Source Han Serif CN', 'Songti SC', 'SimSun', serif;
  --font-ui: system-ui, -apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, 'SF Mono', Consolas, monospace;
```

- [ ] **Step 2: 标题/卡片类元素应用衬线 display 字体**

在 `normal.css` 现有规则上逐条追加 `font-family: var(--font-display);`：

1. `.nh-title`（Hero 主标题，约 176 行，追加在 `font-size` 前）：
```css
[data-theme='normal'] .nh-title {
  font-family: var(--font-display);
  font-size: clamp(2rem, 4.5vw, 2.8rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-text-heading);
  margin: 0 0 10px;
}
```
2. `.nh-witty`（Hero 趣味介绍行，约 188 行）：在块内追加 `font-family: var(--font-display);`（保留 400 字重）。
3. `.nh-section-head h2`（区块标题，约 252 行）：追加 `font-family: var(--font-display);`。
4. `.nh-post-title`（文章卡片标题，约 307 行）：追加 `font-family: var(--font-display);`。
5. `.nh-project-name`（项目卡名称，约 460 行）：追加 `font-family: var(--font-display);`。
6. `.article-title`（文章页标题，约 514 行）：追加 `font-family: var(--font-display);`。
7. `.page-title`（归档/分类/标签页标题，约 479 行）：追加 `font-family: var(--font-display);`。
8. `.post-card .post-title`（列表页卡片标题，追加新规则）：
```css
[data-theme='normal'] .post-card .post-title {
  font-family: var(--font-display);
}
```
9. `.douban-title`（影音页标题，约 676 行）：追加 `font-family: var(--font-display);`。
10. `.archive-group .month`（归档月份标题，追加新规则）：
```css
[data-theme='normal'] .archive-group .month {
  font-family: var(--font-display);
}
```

- [ ] **Step 3: 文章 markdown 标题应用衬线**

在 `normal.css` 末尾（`.markdown-body a/blockquote` 规则附近，约 799 行处）追加：

```css
[data-theme='normal'] .markdown-body h1,
[data-theme='normal'] .markdown-body h2,
[data-theme='normal'] .markdown-body h3 {
  font-family: var(--font-display);
  font-weight: 700;
}
```

- [ ] **Step 4: 数字/元信息应用等宽 mono**

逐条追加 `font-family: var(--font-mono);`（`.nh-post-meta` 与 `.post-meta` 同时追加 `font-variant-numeric: tabular-nums;`）：

1. `.nh-post-meta`（首页卡片元信息，约 332 行）：
```css
[data-theme='normal'] .nh-post-meta {
  display: flex;
  gap: 14px;
  color: var(--color-text-muted);
  font-size: 12px;
  flex-wrap: wrap;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
```
2. `.post-meta`（列表页元信息，追加新规则）：
```css
[data-theme='normal'] .post-meta {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
```
3. `.nh-bubble .num`（统计气泡数字，约 227 行）：追加 `font-family: var(--font-mono);`。
4. `.nh-cat-count`（分类计数，约 363 行）：追加 `font-family: var(--font-mono);`。

- [ ] **Step 5: 验证 CSS 规则已下发**

Run: `curl -s http://localhost:4321/ > /tmp/verify.html && grep -c "Playfair Display" /tmp/verify.html && grep -c "nh-latest-head" /tmp/verify.html`
Expected: 第一行输出 `Playfair Display` 出现次数 > 0；第二行输出 `0`（此任务尚未加该 class，正常）。

同时确认极简主题未被触碰：
Run: `cd /e/zcodework/MBLOG && git diff --name-only`
Expected: 仅包含 `site/src/styles/themes/normal.css`（无 reader.css）。

- [ ] **Step 6: 提交**

```bash
git add site/src/styles/themes/normal.css
git commit -m "style(site): 正常主题字体层级——Playfair 衬线标题 + JetBrains Mono 等宽数字"
```

---

### Task 3: 首页最新文章区块「查看全部文章 →」入口

**Files:**
- Modify: `site/src/pages/index.astro:113`
- Modify: `site/src/styles/themes/normal.css`

- [ ] **Step 1: 修改最新文章区块头**

将 `index.astro` 中最新文章区块头（当前为 `<div class="nh-section-head"><p class="nh-eyebrow">LATEST POSTS</p><h2>最新文章</h2></div>`）替换为：

```astro
      <div class="nh-section-head nh-latest-head">
        <p class="nh-eyebrow">LATEST POSTS</p>
        <h2>最新文章</h2>
        <a class="nh-more" href="/archive">查看全部文章 →</a>
      </div>
```

- [ ] **Step 2: 新增居中纵向布局样式**

在 `normal.css` 的 `.nh-section-head h2` 规则之后追加：

```css
/* 最新文章区块头：标题 + 查看全部入口居中 */
[data-theme='normal'] .nh-section-head.nh-latest-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
```

（`.nh-more` 样式已存在：14px、muted、hover 变琥珀色，直接复用。）

- [ ] **Step 3: 验证链接与样式已下发**

Run:
```bash
curl -s http://localhost:4321/ > /tmp/verify2.html
grep -c "查看全部文章" /tmp/verify2.html
grep -c "nh-latest-head" /tmp/verify2.html
grep -oE "\.nh-section-head\.nh-latest-head \{[^}]*\}" /tmp/verify2.html
```
Expected: 前两行输出 `1` 与 `1`；第三行输出包含 `display:flex` 的完整规则。

- [ ] **Step 4: 提交**

```bash
git add site/src/pages/index.astro site/src/styles/themes/normal.css
git commit -m "feat(site): 首页最新文章区块增加查看全部文章入口（/archive）"
```

---

### Task 4: 浏览器验证与收尾

**Files:** 无（仅验证）

- [ ] **Step 1: 浏览器打开首页验证字体生效**

用 browser-use 打开 `http://localhost:4321/`，执行只读检查：
1. `document.fonts.check('700 24px "Playfair Display"')` → `true`（Playfair 已加载）
2. `document.fonts.check('12px "JetBrains Mono"')` → `true`（JetBrains Mono 已加载）
3. 首页「最新文章」h2 的 `getComputedStyle().fontFamily` 包含 `Playfair Display` 或 `Noto Serif SC`
4. 首页卡片 meta 的 `getComputedStyle().fontFamily` 包含 `JetBrains Mono`
5. 最新文章区块内存在链接「查看全部文章 →」，`href="/archive"`

- [ ] **Step 2: 确认极简主题零改动**

Run: `cd /e/zcodework/MBLOG && git diff HEAD~3 --stat -- site/src/styles/themes/reader.css`
Expected: 无输出（reader.css 自始至终未被修改）。

- [ ] **Step 3: 清理**

- 关闭视觉伴侣服务：`scripts/stop-server.sh /e/zcodework/MBLOG/.superpowers/brainstorm/3329-1786421368`
- 浏览器验证标签页保留供用户查看。

**完成标准：** 正常主题全站出现「衬线标题 × 无衬线正文 × 等宽数字」三级字体；首页最新文章区块有指向 `/archive` 的「查看全部文章 →」；极简主题外观与字体零变化。
