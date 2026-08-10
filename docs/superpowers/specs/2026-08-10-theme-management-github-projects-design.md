# MBLOG 主题管理 + GitHub 项目展示 设计文档

日期：2026-08-10
状态：已确认

## 背景

MBLOG 前台有正常（normal）与极简（reader）双主题。目前主题样式全部硬编码在 CSS 中，
首页文章数固定为 10。现需要在后台提供：

1. 主题管理：分别管理正常/极简两个主题的**外观参数**与**首页文章数**。
2. GitHub 项目展示：后台设置 GitHub 账号，前台自动拉取并展示公开仓库。

## 一、主题管理

### 1.1 可配置参数（每主题一套）

| 参数 | 键 | 说明 | 校验 |
|---|---|---|---|
| 背景色 | `bg` | 页面背景 | 合法色值 |
| 正文色 | `text` | 正文/标题文字 | 合法色值 |
| 次要文字色 | `muted` | 日期、说明等 | 合法色值 |
| 主色 | `primary` | 链接、强调色 | 合法色值 |
| 边框色 | `border` | 发丝边框/分隔线 | 合法色值 |
| 正文字号 | `fontSize` | px | 12–24 整数 |
| 首页文章数 | `homePageSize` | 该主题首页每页文章数 | 1–50 整数 |

### 1.2 存储

设置中心（key-value）新增两个键：

- `theme_normal`：正常主题配置，JSON 字符串
- `theme_reader`：极简主题配置，JSON 字符串

未配置或字段为空时，回退到 CSS 内置默认值（不注入覆盖）。

### 1.3 生效机制（SSR 注入 CSS 变量）

不修改 CSS 文件、无构建期依赖。BaseLayout SSR 时读取两个主题配置，在 `<head>`
末尾注入一段 `<style>`：

```html
<style>
  [data-theme='normal'] { --color-bg:#f5f6f8; --color-text:#1f2328; …; --font-size:16px; }
  [data-theme='reader'] { --color-bg:#f3f0e9; --color-text:#2e2c28; …; --font-size:17px; }
</style>
```

- 同优先级选择器、后声明覆盖，故注入块位于主题 CSS 之后即可生效。
- 两个主题的配置都注入：用户在前台切换主题（仅换 `data-theme`，不重载），两套变量都在。
- 前置重构：`reader.css` 的 body `font-size: 17px` 改为 `var(--font-size)`，并在其
  `[data-theme='reader']` 块声明 `--font-size: 17px`，使字号走统一变量。

### 1.4 首页文章数

`index.astro` 的 `pageSize` 由 `settings.theme`（服务端默认主题）对应的 `homePageSize`
决定，用于 SSR 分页。切换主题不重排内容（双主题架构的固有边界）。

### 1.5 后台 UI

新增独立页面 **主题管理** `/admin/themes`（AdminLayout 侧栏加导航项）：

- 两个 Tab：正常主题 / 极简主题
- 每 Tab：颜色选择器 × 5（`<input type="color">`）+ 字号输入 + 首页文章数输入
- 保存 → `PUT /admin/settings` 提交 `theme_normal` / `theme_reader` JSON
- 表单内可一键恢复默认（清空字段）

## 二、GitHub 项目展示

### 2.1 设置

设置中心新增：

- `github_enabled`：'1' / '0'（默认 '0'，未开启时项目页显示提示）
- `github_username`：GitHub 账号名

放于后台「设置」页新增的「GitHub 展示」fieldset。

### 2.2 后端数据服务

新增公开接口 `GET /api/projects`（github.ts 内 `app.get('/projects')`，由 publicRoutes 挂载于 `/api` 下）：

- 若 `github_enabled` 非 '1' 或用户名为空 → `{ data: { enabled: false } }`
- 服务端请求 `https://api.github.com/users/{username}/repos?per_page=100&sort=updated`
  （带 `User-Agent`、`Accept: application/vnd.github+json`）
- 过滤：排除 fork，按 `stargazers_count` 降序，截取前 20
- 输出字段：`name`、`description`、`html_url`、`language`、`stars`、`updatedAt`
- **内存缓存 30 分钟**（Map<username, { time, data }>）规避 GitHub 匿名限流（60 次/小时）
- 拉取失败：有缓存则返回缓存，否则 `{ data: { error: '…' } }`，前台显示友好提示

### 2.3 前台页面

新增 `/projects`（标题「项目」）：

- SSR 调用 `getProjects()`（site 侧 API 客户端）
- 状态：
  - 未开启 → 「未开启 GitHub 展示」提示
  - 错误 → 提示 + 附 GitHub 主页链接
  - 空仓库 → 空态文案
  - 正常 → 仓库列表：名称（外链）、简介、语言 + 星数徽标、更新时间
- 双主题适配：
  - 正常主题：卡片网格（`.project-card`，沿用 link-card 风格，normal.css 新增）
  - 极简主题：单列细线行（沿用友链页克制风格，reader.css 新增规则）
- 导航菜单默认项加入「项目」→ `/projects`（后台仍可增删）

## 三、涉及文件

**后端 `backend/`**
- `src/lib/settings.ts`：DEFAULT_SETTINGS 新增 `theme_normal`、`theme_reader`、
  `github_enabled`、`github_username`；nav_menu 默认加入「项目」
- `src/routes/public/misc.ts`：`/settings/public` 返回 `themeNormal`、`themeReader`
  （解析 JSON）、`githubEnabled`、`githubUsername`
- `src/routes/public/github.ts`（新）：`app.get('/projects')`，GitHub 拉取 + 缓存
- `src/routes/public.ts`：挂载 github 路由

**前台 `site/`**
- `src/lib/api.ts`：PublicSettings 扩展 + `getProjects()`
- `src/layouts/BaseLayout.astro`：注入主题配置 `<style>`
- `src/styles/themes/reader.css`：body 字号改变量；新增 /projects 克制样式
- `src/styles/themes/normal.css`：/projects 卡片样式（如需）
- `src/pages/index.astro`：pageSize 取自默认主题配置
- `src/pages/projects.astro`（新）

**后台 `admin/`**
- `src/router/index.ts`：新增 `/themes` 路由
- `src/views/AdminLayout.vue`：侧栏加「主题管理」
- `src/views/ThemesPage.vue`（新）：双 Tab 主题配置表单
- `src/views/SettingsPage.vue`：新增 GitHub fieldset

## 四、边界与错误处理

- 配置 JSON 非法 → 忽略该主题配置，用 CSS 默认值
- 颜色/数值非法 → 后台保存前前端校验 + 后端忽略非法值
- GitHub 限流/网络失败 → 缓存兜底 → 友好错误提示，不阻断其他页面
- 首页分页 pageSize 上限 50（对齐后端）

## 五、测试

- 后台：保存主题配置 → 前台 SSR HTML 出现注入的变量覆盖 → 对应主题生效
- 首页文章数：设小值 → 首页文章数与分页变化
- 配置恢复默认：清空字段 → 回退 CSS 默认
- GitHub：未开启 / 用户名为空 / 拉取成功 / 模拟失败（错误提示）四种状态
- 双主题 /projects 视觉与 archive/friends 一致
