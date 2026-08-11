# MBLOG 项目记忆文档（会话交接）

> 最后更新：2026-08-11 17:30（当日会话结束时）
> 用途：跨会话记忆，供明天继续开发使用。开发前先读本文件 + `git log --oneline -20`。

---

## 1. 项目概览

MBLOG 是个人博客系统，**三端分离**，代码都在本仓库根目录：

| 应用 | 目录 | 技术栈 | 端口 |
|---|---|---|---|
| 后端 API | `backend/` | Node + Hono + Drizzle ORM + better-sqlite3 | :3000 |
| 前台站点 | `site/` | Astro 5（SSR, node adapter）+ Vue 3 islands | :4321 |
| 后台管理 | `admin/` | Vue 3 + Vite + vue-router，base `/admin/` | :5173 |

- **双主题**：normal（主视觉主题，Playfair 衬线高对比）+ reader（极简主题）
- **部署**：docker-compose（api / site / nginx web），`deploy/nginx` 反代
- **工作流**：直接提交 `main` 分支（既定约定）；每次改动构建/测试通过后再 commit

### 启动方式（本机开发）

```bash
# 后端（自动建库迁移，端口 3000）
cd backend && npm run dev
# 环境变量：JWT_SECRET(≥32字符，否则 fail-fast)、ADMIN_USERNAME/ADMIN_PASSWORD（生产必填）

# 前台（SSR，端口 4321，环境变量 API_BASE=http://localhost:3000）
cd site && npm run dev

# 后台（Vite dev，端口 5173）
cd admin && npm run dev

# 验证
cd backend && npm test          # vitest 全量（目前 83/83 通过）
cd site && npm run check        # astro check 类型检查
cd admin && npm run typecheck   # vue-tsc
```

## 2. 后端（backend/）

### 结构

- `src/index.ts` — 入口：`import 'dotenv/config'`、`ensureMigrated()`、serve :3000
- `src/app.ts` — Hono app 组装（JWT 中间件、/admin 保护、/public 开放）
- `src/db/` — `index.ts`(sqlite 连接) / `schema.ts`(全部表) / `migrate.ts`(幂等迁移)
- `src/lib/` — `captcha.ts`(数学验证码)、`turnstile.ts`(Cloudflare Turnstile)、`jwt.ts`、`settings.ts`(settings 表读写+默认值)、`slug.ts`、`themeConfig.ts`
- `src/routes/public/` — posts / categoriesTags / comments / talks / douban / friendLinks / github / cover / misc / stats
- `src/routes/admin/` — auth / posts / categories / tags / comments / talks / friendLinks / douban / settings / upload
- `test/` — vitest，11 个文件，helpers.ts 提供 `makeTestApp`/`loginAsAdmin`/`authHeaders`

### 数据库表（schema.ts）

posts（含 `likeCount`、`status`）、categories、tags、post_tags、comments（含 `website` 字段）、talks、friend_links、settings（key-value，含 turnstile_site_key/secret_key 默认值）、projects（github 同步）、douban_movies 等。

**迁移约定**：`migrate.ts` 全部幂等（PRAGMA table_info + `ALTER TABLE`/`CREATE TABLE IF NOT EXISTS`），直接执行不会报错，不要手改生产库。

### 关键机制

- **认证**：JWT（jose），`JWT_SECRET` 长度 <32 直接抛错；登录走 `/admin/auth/login`
- **分页响应**：所有 admin 分页接口返回 `{ list, total }` 而非数组（测试断言同步了这个 shape）
- **mask 约定**：敏感字段回显用 `'********'`，避免泄露
- **评论验证码**：优先 Cloudflare Turnstile（`verifyCaptcha` 有 site/secret 时启用），否则降级 math-captcha（内存 Map、一次性、5min TTL）+ honeypot 字段 `_hp`
- **markdown 渲染**：remark-gfm + rehype-highlight + rehype-sanitize（`rehype-raw` 白名单）
- **上传**：`/admin/upload`，本地盘 + COS SDK（cos-nodejs-sdk-v5）双支持
- **OG 图**：`/og/[slug].png` 用 sharp 渲染 SVG→PNG，**中文依赖服务器 CJK 字体**（部署环境需装字体）
- **douban**：`/public/douban` 等，含 TMDB 同步（`douban-tmdb-sync` plan）

## 3. 前台站点（site/）

### 页面（src/pages/）

index（双渲染 `.reader-home`/`.normal-home`）、posts.astro（全部文章，**PAGE_SIZE=8 SSR + PostLoadMore 分段加载**）、post/[slug].astro、category/、tag/、archive、search、projects、friends、douban、talk、404、og/[slug].png.ts

### 组件（src/components/）

- `BorderGlow.vue` — 首页卡片发光边框（document 级 pointermove 委托，设 `--edge-proximity`/`--cursor-angle`）
- `GradientBlob.vue` — 多层 radial-gradient + blur(70px) 渐变光装饰
- `PillNav.vue` — 胶囊导航（主题切换后必须重算宽度：`getClientRects().length===0` 时设 `width:'auto'`，监听 `mblog-theme-change`）
- `ThemeToggle.vue` — **View Transitions 圆形主题切换**（clip-path 动画，fallback opacity fade）
- `LineSidebar.vue` — 文章 TOC 侧边线动效（无边框；observer 回调里要重启 rAF loop）
- `MobileHeader.vue` — 汉堡菜单 + 滑出面板（≤768px，两主题通用）
- `MobileToc.vue` — 窄屏 TOC drawer
- `CommentSection.vue` — 评论（website 字段 + Turnstile/math-captcha 分支）
- `LikeButton.vue` — POST like，localStorage `mblog_liked_${slug}` 防重复
- `PostLoadMore.vue` — infinite scroll sentinel（IntersectionObserver rootMargin 160px）
- `LiquidEther.vue` / `BlurText.vue` — Reactbits 移植装饰组件

### 双主题机制（最关键的约定）

1. **所有 CSS 带主题前缀**：`[data-theme='normal'] ...` / `[data-theme='reader'] ...`，两主题互不污染（字体改动不得影响 reader 极简主题）
2. 双渲染页面（如首页）用 `.reader-home` / `.normal-home` 包裹两个 DOM
3. 主题切换通过 `document.documentElement.dataset.theme`，组件监听 `mblog-theme-change` 自定义事件
4. 样式文件：`src/styles/themes/normal.css` + `reader.css`（normal 含 hero/banner/article/posts/border-glow/mobile 等全部主视觉）
5. **GSAP 导入必须用 `gsap/dist/gsap.js`**（CJS，Vite 下直接 `import gsap from 'gsap'` 可能炸）
6. **Vue template 中禁止 `<script>`/`<style>`**（Astro island 限制）

### 文章页布局（final 版本）

- 有封面：横向 banner，**标题覆盖在 banner 内**，banner 与"正文+TOC"整体对齐（文章容器同宽）
- 无封面：居中标题 + 顶部渐变光装饰
- LineSidebar TOC 固定 `grid-row: 2`（否则无封面时错位）
- 文末：标签分割线 → 评论 → prev/next 导航
- JSON-LD script 已加

### 数据获取

- `src/lib/api.ts` — 类型 + fetch 封装（PostDetail 含 prev/next/likeCount；PublicSettings 含 siteUrl/turnstileSiteKey）
- `src/middleware.ts` — settings 每请求一次存入 `Astro.locals`
- `src/lib/toc.ts`、`techLogos.ts`

## 4. 后台管理（admin/）

### Views（src/views/）

AdminLayout（暗色侧栏 + icons + 移动抽屉 + `isActive()` 精确导航判断）、Login、Dashboard（刚重写）、PostList、PostEditor、CategoryManager、TagManager、CommentManager、FriendLinkManager、TalkManager、SettingsPage、ThemesPage

### 关键约定

- **共享暗色系统**：`src/styles/admin.css`（cards/tables/buttons/badges/pagination/toast），含 `color-scheme: dark`、`:focus-visible`、`touch-action: manipulation`
- **Toast**：`src/lib/toast.ts` + `ToastContainer.vue`，所有操作反馈统一走 toast
- **PostEditor**：暗色 Vditor（自定义 toolbar、上传 contract `format` wrapper）、封面上传、localStorage 自动保存草稿（`mblog_admin_draft_${new|edit_${id}}`）、字数统计、TagPicker
- **TagPicker**：可搜索多选 + 内联创建；**必须用 `watch(() => props.tags, ...)` 同步异步 props**（直接初始化 ref 会拿到空数组）；默认折叠，仅搜索时显示选项
- **TalkManager**：compose 发布框（发送图标、450 字琥珀 / 500 字红提示）；**talk 发布者=作者，直发免审核**（无需审核流程）
- **Dashboard**（最新）：彩色图标统计卡（postTotal/published/commentTotal/totalViews）+ 条件显示的待审核评论卡 + 快捷操作面板
- 分页响应 `{ list, total }`；表格行 hover、空态

### 已知修复模式（避免回退）

- 侧栏高度自适应：内容超出视口时内部滚动（`overflow` 处理）
- 设置页：双列 grid + field-pair + card--full 等高布局
- 登录页：暗色卡片 + blob 背景 + 密码显隐

## 5. 本轮会话已完成的工作（2026-08-11）

前台（部分已多日完成，本轮重点是）：
- 全部文章页 `/posts`（eonova 风格列表 + 分段加载）
- 文章页 banner 布局迭代（压题→居中→圆形→最终"标题在 banner 内"横版）
- LineSidebar 目录动效、prev/next 导航、JSON-LD、Like、移动端 TOC、GradientBlob
- Turnstile 评论验证（math-captcha fallback）、评论 website 字段
- View Transitions 圆形主题切换、顶部渐变光
- 移动端适配（MobileHeader 汉堡菜单、宽度自适应、横向溢出修复）
- Talk 改作者直发免审核（公开表单移除）

后台：
- 全站暗色化（共享样式库 + Toast）、登录页重设计、设置页双列等高、侧栏自适应+导航激活修复、TagPicker（含 bugs 修复）、说说发布框、web-design-guidelines skill 审计修复
- **仪表盘增强**（最后提交 `0fe6972`：图标统计卡 + 快捷操作）

提交历史（最近 15 条见文首 git log 输出），工作区干净。

## 6. 待办 / 下一步

- **整体优化后台 UI**（进行中）：Dashboard 已完成；剩余可打磨：PostList（行点击进编辑、hover 细节、tabular-nums）、CategoryManager / TagManager（add-row 与卡片一致 + 空态 + 编辑取消）、FriendLinkManager 润色、全局 admin.css 收尾
- eonova.me 借鉴清单中 **low-priority 项**（会话实现时排除的部分）
- 部署验证：OG 图中文需服务器 CJK 字体（check docker image）
- 若做：说说前台互动、评论区增强等（未定）

## 7. 已知坑（踩过，别再来一遍）

1. **Astro template 里 `${}` 插值**：`class="a {cond ? b : c}"` 会输出字面量，必须 `` class={`a ${cond ? b : c}`} ``
2. **移动端横向溢出**：grid item 默认 `min-width:auto` → 用 `minmax(0,1fr)` + `min-width:0`；inline code 加 `overflow-wrap:anywhere`
3. **Grid 自动放置错位**：TOC 等要显式指定 grid-row/grid-column
4. **PillNav 折叠**：主题切换后必须重算（见上）；`getClientRects().length===0` 分支
5. **`router-link-active` 前缀匹配**：`to="/"` 会常亮，需自定义 `isActive()`
6. **IAB 浏览器自动化**（cua/playwright click）不稳定，交互验证可能失败——用 DOM/hydration 检查代替，别浪费时间
7. **Windows 路径**：Git Bash 下用 forward slashes
8. **Settings 卡片**：改布局时别误粘贴重复卡片（发生过一次）
9. **测试断言**：分页 shape 改 `{list,total}` 后，admin.test.ts:304/361、stats.test.ts:38 必须同步
10. **字体/样式改动**：永远带 `[data-theme='normal']` 前缀，别碰 reader

## 8. 参考

- 灵感/借鉴：https://eonova.me 源码 https://github.com/eonova/eonova.me
- Reactbits 组件移植（border-glow / pill-nav / blur-text / liquid-ether / line-sidebar / gradual-blur(已移除)）
- 已安装 skill：`web-design-guidelines`（C:\Users\HUAWEI\.agents\skills\web-design-guidelines）、`ui-inspiration-triad`、`ui-ux-pro-max` 等
- 历史 spec/plan 在 `docs/superpowers/`（typography、douban、theme 等）
