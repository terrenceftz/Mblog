# MBLOG 项目记忆文档（会话交接）

> 最后更新：2026-08-16（About 页结构化名片块 + reader 视频修复）
> 用途：跨会话记忆，供下次继续开发使用。开发前先读本文件 + `git log --oneline -20`。

---

## 0. 环境（2026-08-12 定稿）

- **Node v24.19.0**（winget OpenJS.NodeJS.LTS）+ **pnpm 11.21**（corepack enable）。保持 Node 24。
- **better-sqlite3 = ^12.11.1**（有 Node 24 prebuilt；**不要升 v13**——无 prebuild 需 VS 编译必失败）。重装后 `npm test` 验证（当前 83/83）。
- site（Astro 5.18 + sharp 0.34）在 Node 24 正常；admin（Vite 6）正常。
- **GitHub 远程已关联（2026-08-12）**：`origin = https://github.com/terrenceftz/Mblog.git`（**Public**，主分支 main，262 commits）。`gh` 已登录 terrenceftz。
- 坑：MSI 换 node.exe 前必须停所有 node 进程；Windows npm 脚本用 cross-env；pnpm build 许可在 pnpm-workspace.yaml allowBuilds。
- 三端 dev server 由 ZCode 会话后台托管（后端 3000 / site 4321 / admin 5173）。



## 1. 项目概览

MBLOG 是个人博客系统，**三端分离**，代码都在本仓库根目录：

| 应用 | 目录 | 技术栈 | 端口 |
|---|---|---|---|
| 后端 API | `backend/` | Node + Hono + Drizzle + better-sqlite3 | :3000 |
| 前台站点 | `site/` | Astro 5（SSR, node adapter）+ Vue 3 islands | :4321 |
| 后台管理 | `admin/` | Vue 3 + Vite + vue-router + Tabler | :5173 |

- **双主题**：normal（暗色科技风，Playfair 衬线 + 琥珀主色 + WebGL 流体 + 辉光）+ reader（极简浅色）
- **双主题各自独立导航菜单**（`nav_menu_normal` / `nav_menu_reader`），后台「主题配置」分别编辑
- **功能**：文章（Vditor 富文本/草稿自动保存）、分类/标签/归档/搜索（FTS5 中文）、评论（Turnstile/数学验证码 + 审核）、友链、GitHub 项目、豆瓣影音、说说、**相册**（瀑布流 + lightbox + 后台管理）、**关于页**（后台编辑 + eonova 名片式）
- **部署**：docker-compose（api / site / nginx），`deploy/nginx` 反代
- **⚠️ 线上真相（2026-08-12 确认）**：cs.mboker.cn 实际走**宿主 Nginx**（非 docker-compose！），见下方「生产部署」节
- **工作流**：直接提交 `main`；已关联 GitHub 远程

### 启动方式（本机开发）

```bash
cd backend && npm run dev    # :3000（自动建库迁移）
cd site && npm run dev       # :4321（环境变量 API_BASE=http://localhost:3000）
cd admin && npm run dev      # :5173
# 验证：backend npm test（83/83）· site npm run check · admin npm run typecheck
```

## 2. 后端（backend/）

### 结构
- `src/index.ts`（dotenv + ensureMigrated + serve）、`src/app.ts`（Hono 组装 + `/api` 公开 + `/api/admin` 认证）
- `src/db/` schema.ts / migrate.ts（幂等）/ index.ts
- `src/routes/admin/`：auth/posts/categories/tags/comments/talks/**photos**/friendLinks/douban/settings/upload
- `src/routes/public/`：posts/categoriesTags/comments/talks/**photos**/friendLinks/github/douban/cover/stats/misc
- `src/lib/`：settings / jwt / captcha / turnstile / themeConfig / slug

### 数据库表
posts、categories、tags、post_tags、comments、talks、**photos**（url/title/description/sort_order）、friend_links、media_files、settings（key-value）、douban 相关。
迁移约定：全部幂等（CREATE TABLE IF NOT EXISTS / PRAGMA 检查），直接执行不报错。

### 关键机制
- **认证**：JWT（jose），JWT_SECRET <32 抛错；登录 `/api/admin/login`（**注意不是 /auth/login**）
- **settings 白名单**：PUT /admin/settings 只接受 DEFAULT_SETTINGS 里的 key；MASKED_KEYS 掩码 `********`
- **public settings 返回**：`navMenuNormal` / `navMenuReader` / `aboutContent`（2026-08-12 由单数 navMenu 拆分——**破坏性变更**，前台类型和测试断言需同步）
- 上传：`/admin/upload`（魔数嗅探拒 SVG），返回相对 url（/uploads/...）
- 分页 shape `{ list, total }`；错误 `{ error: { code, message } }`

## 3. 前台站点（site/）

### 页面
index（双渲染 .reader-home/.normal-home）、posts、post/[slug]（TOC + 相关文章 + 评论）、archive、category/、tag/、search、friends、projects、douban、talk、**gallery（相册）**、**about（关于）**、404、sitemap.xml.ts、robots.txt.ts、og/[slug].png.ts

### 组件
- **PhotoGallery.vue** — reactbits Masonry 移植：CSS columns 瀑布流 + GSAP stagger 入场 + hover 缩放 + 点击 lightbox（Esc/点击关闭）
- **HeroBackground.vue** — 桌面渲染 LiquidEther 流体，低端/减少动态降级为静态渐变（`capabilities.ts` fancy 检测）
- **StatBubbles.vue** — 统计气泡 count-up（easeOutCubic，reduced-motion 直接落定）
- **BorderGlow / BlurText / LiquidEther / LineSidebar / PillNav / ThemeToggle / MobileHeader / MobileToc / CommentSection / LikeButton / PostLoadMore / FriendLinkForm**
- `scripts/`：reveal.ts（`[data-reveal]` 滚动入场，一次性 IntersectionObserver）、code-enhance.ts（代码块语言标签 + 复制按钮）、lenis.ts、capabilities.ts

### 双主题机制（最关键约定）
1. 所有 CSS 带 `[data-theme='normal']` / `[data-theme='reader']` 前缀，互不污染
2. 主题切换：`document.documentElement.dataset.theme` + `mblog-theme-change` 自定义事件
3. **双主题菜单**：BaseLayout 侧栏渲染两套 `.site-nav-menu[data-menu-for="normal/reader"]`，CSS 按 html[data-theme] 显示对应；PillNav（顶栏，normal 专属）用 navMenuNormal；MobileHeader 接收 normalItems/readerItems 按主题切换
4. GSAP 必须 `gsap/dist/gsap.js`；Vue template 禁 `<script>/<style>`
5. **智能降级**：`capabilities.ts`（hardwareConcurrency/deviceMemory/pointer:coarse/WebGL）→ 桌面 fancy=true 全特效；`data-lowend` 标记关 backdrop-filter；reduced-motion 关动画
6. 相册 URL：后端返回相对 /uploads，前台 gallery.astro 拼 `${API_BASE}` 成绝对 URL

### 数据获取
- `src/lib/api.ts`：PublicSettings 含 navMenuNormal/navMenuReader/aboutContent；getPhotos()/getTalks() 等
- `src/middleware.ts`：settings 每请求存 Astro.locals

## 4. 后台管理（admin/）

### Views
AdminLayout（navbar-vertical 侧栏 + 主题三态）、Login、Dashboard、PostList、PostEditor（真实 Vditor + 草稿自动保存 + 音频插入）、CategoryManager、TagManager、CommentManager、TalkManager、**PhotoManager（相册管理）**、FriendLinkManager、SettingsPage（博主信息含**关于内容 textarea**、存储、Turnstile、GitHub、改密码、豆瓣同步）、ThemesPage（配色 + **双主题导航菜单，随布局模式联动**）

### 关键约定
- **设计体系**：`--mb-*` 变量（admin.css）+ Tabler 组件类（card/card-body/btn/form-control/badge-soft）
- **API 适配层** `src/api/admin.ts`：`api.xxx()` 签名 + 字段映射；client.ts request（Bearer + FormData 自动 Content-Type）
- **PhotoManager**：本地上传（canvas 压缩至 1600px JPEG 0.82 再传，减少卡顿）+ 外部 URL 添加 + 改标题（prompt）+ 删除
- **ThemesPage 导航菜单**：随 layoutMode（Normal/Reader）切换显示对应菜单，保存时 `updateSettings({ navMenuNormal/navMenuReader })`
- 主题机制 `lib/theme.ts`：mblog_theme key + data-theme/data-bs-theme 双属性
- Toast：`lib/toast.ts`

## 5. 今日已完成的工作（2026-08-12，按时间线）

1. **首页最新文章 3×3**：`.nh-post-grid` 固定 `repeat(3, minmax(0,1fr))` + `slice(0,9)`（正常主题）
2. **友链/项目/影音页对齐 posts/archive 风格**：PageHeader 骨架（posts-page + GradientBlob + header/count）+ normal 专属卡片 hover
3. **normal 主题全面优化**（e6e4514）：主题色变量化（color-mix 替 rgba 主色，后台改 primary 端到端生效）、智能降级（capabilities + HeroBackground + data-lowend）、a11y（skip-link/focus-visible/label）、SEO（canonical/og/twitter + 动态 sitemap/robots + JSON-LD wordCount/Breadcrumb）、P0（grid 溢出 minmax、异常 catch、post 真 404）、资源清理（CommentSection Turnstile disposed 等）、抽组件（PageHeader/Pagination/lib/date.ts）
4. **首页视觉质感**（796aa1e）：滚动入场（reveal.ts + data-reveal stagger）、StatBubbles count-up、卡片多层 hover（封面 scale + 阴影）、背景纵深（顶部琥珀微光）、标题放大、区块节奏
5. **文章页体验**（796aa1e）：代码块语言标签 + 一键复制（code-enhance.ts）、相关文章（同分类 3 篇带封面）、strong/mark 强调
6. **reader 回归修复**（b1fca22）：TOC 恢复（Fragment slot 嵌套失效，移到 BaseLayout 直接子级）、reader related 样式、GradientBlob reader 隐藏改 reader.css 外部规则（:global 事故）
7. **reader 文章页 prev/next 极简适配**（33df582）
8. **相册模块**（b76756e）：photos 表 + admin/public API + 前台瀑布流（Masonry 移植）+ 后台 PhotoManager；修复上传相对路径校验（URL_RE 放宽）+ gallery 拼绝对 URL + 选图 canvas 压缩
9. **关于页后台化**（b76756e + 0ef6f8f）：about_content 后台编辑 + eonova 名片式分段（空行分段 + 段首 emoji 自动识别标签）
10. **双主题菜单**（b76756e）：settings 拆 nav_menu_normal/reader + 前台双套 + 后台主题设置编辑（随布局模式联动）；站点设置移除导航卡
11. **GitHub 推送**（0ef6f8f）：README 完整重写 + 创建远程仓库 **terrenceftz/Mblog（Public）** + push main
12. **首页偶发极慢修复**（7adfa38 + 本会话）：根因=首页 SSR 同步等待 `/api/douban`（豆瓣分页+TMDB 逐部）与 `/api/projects`（GitHub 无超时），30min 缓存过期即阻塞（nginx 60s 超时实证）。修复：公开接口 **stale-while-revalidate 永不阻塞**（有旧数据立即返回 stale，无则空+syncing，后台单飞刷新），GitHub fetch 补 10s 超时，site fetch 补 12s 兜底。测试 83→85。
13. **前台特效全无修复**（本会话）：根因=`mblog_theme` localStorage key 被后台/前台共用——后台写入 light/dark/system（默认 system），前台 ThemeToggle 无验证套用到 `data-theme` → 变成 'system' → 双主题 CSS 全部失效 + LiquidEther `isNormalTheme()` 判 false → 特效全无（用户每开过后台再刷首页即触发）。修复：前台只接受 normal/reader 并清理非法残留；后台改独立 key `mblog_admin_theme`（含 mblog_theme/admin_theme 迁移，仅迁移后台主题值不误删前台值）+ index.html 首屏脚本同步。已部署。

**当前提交链**：`0ef6f8f`（docs README + 名片式 + 后台修复）→ `b76756e`（相册 + 关于后台 + 双主题菜单）→ `33df582`（reader prev/next）→ `b1fca22`（reader 空白修复）→ `796aa1e`（首页视觉 + 文章页 + reader 回归）→ `e6e4514`（normal 全面优化）→ `319a081`（上一版记忆）

---

## 5b. 今日已完成的工作（2026-08-15，视觉改版 + 性能，按主题分）

> 本轮工作流：先读记忆 → 性能/健壮性优化 → 首页视觉改版 → 文章页改版 → 归档/关于/相册改版 → 线上部署。全部改动带 `[data-theme='normal']` 前缀，reader 不受影响。

### 性能 / 健壮性（P0 优先）
1. **three.js 按需加载**：`HeroBackground.vue` 改 `defineAsyncComponent` 动态 import LiquidEther——LiquidEther chunk（531KB，含 three.js）只在桌面 fancy 时下载，低端/移动端首屏不再背负；构建产物确认独立 chunk。
2. **SSR 请求缓存**：`site/src/lib/api.ts` 的 `get()` 加进程内 **30s TTL + 单飞去重**（仅服务端，`typeof window === 'undefined'` 才启用）。首页单次渲染从 7 个后端请求降为缓存命中。backend `stats.ts` 的 totalViews 从全表取回 JS reduce → **SQL `SUM()`**（`coalesce(sum(...),0)`）。
3. **字体按默认主题拆分**：BaseLayout 阻塞加载默认主题的家族（normal：Playfair+Noto Serif SC+JetBrains Mono；reader：Lora+EB Garamond+同一组）+ 另一主题独有字体用 `<link rel="preload" as="style" onload=...>` 异步预载（含 `<noscript>` 兜底）。不再一次拉 5 家族。
4. **a11y 三连**：BlurText 补 `prefers-reduced-motion` 直通 + `will-change` 动画结束即回收；StatBubbles 改为 **SSR 直出真实值**（禁 JS/SEO 不再显示 0），水合后从 0 count-up；Lenis 平滑滚动 reduced-motion 跳过。
5. **水合瘦身**：MobileHeader 改 `client:media="(max-width: 768px)"`（桌面端不水合）；首页 pageSize 按主题：reader 用主题配置，normal 固定取 5 篇（索引列表用）。
6. **SEO**：首页补 JSON-LD（`WebSite` + `Person` + `SearchAction`），BaseLayout 加 `<slot name="head">`。
7. **响应式**：新增 900px 中窄断点（hero 双栏提前纵向堆叠）；豆瓣中屏 4 列过渡。
8. **辉光色变量化**：border-glow 的 `--glow-color*` 从硬编码 `hsl(43 80% 60%)` 改为 `--color-primary` + color-mix 派生，后台改主色端到端生效。
9. **接口契约**：`PostListItem.likeCount` 列表接口不返回 → 从 PostListItem 移除、PostDetail 单独声明（detail 路由才返回）。
10. **豆瓣/媒体相对路径修复**：首页豆瓣封面、文章页封面与相关文章封面渲染时用 `absUrl()` 把 `/api/cover`、`/uploads` 相对路径拼 `API_BASE` 绝对 URL。**根因**：本地构建产物直跑 `node dist/server/entry.mjs` 无 `/api` 反代 → 相对图 404；dev 有 Vite proxy 无感，线上有 nginx 反代无感。**注意 API_BASE 环境变量现在同时影响图片加载，生产必须配对。**

### 首页视觉改版（normal，「编辑/作品集」语言）
- **Hero 大字排版**：`你好，我是` 改为 sans 引导小字（`nh-title-lead`）与名字同行，署名 `nh-title-name` 超大**斜体衬线**（clamp 2.6rem→4.8rem），级联入场（眉标 0 → 引导 120 → 署名 380 → 介绍 1000ms，BlurText stepDuration 0.3 更柔）。
- **最新文章 → 索引式列表**（`nh-post-index`）：`01 · MM-DD · 大标题 · 分类 →` 行式（分隔线），hover 整行微亮 + 标题变琥珀右移 + 箭头滑入 + **封面图浮动浮现**（桌面 >900px，绝对定位 190px 卡微旋转上浮；≤900px 隐藏）。
- **分类与标签 → 目录式**：分类 leader dots + mono 计数（多列 auto-fill 230px）；标签退为 mono `#标签` 文字流。全部为空时区块不渲染。
- **豆瓣 → 横向 scroll-snap 海报带**（flex + scroll-snap，移动端出血边缘），hover 底部渐变遮罩滑出片名 + ★评分。
- **区块头编辑式**：中文大标题（clamp 1.7→2.15rem）+ 斜体琥珀英文小词（Writing/Index/Screening/Work）+ 点线引导连右侧入口（`.nh-section-head` + `.nh-head-en` + `.nh-head-rule`）。

### 文章页改版（post/[slug].astro）
- **头部**：新增 `.article-kicker`（`分类 · 日期` mono 眉标，分类琥珀可点）；无封面 = 左对齐编辑式（渐变光左移）；**有封面 = 左下角压图**（banner 240→300px，底部渐变加重，标题+kicker+meta 靠左下）。
- **h2 自动编号**：CSS counter `article-h2`，mono 琥珀 `01/02` 前缀 + 40px 琥珀短刻度（替代全宽下划线），与首页索引/右侧目录编号呼应。
- **首段首字下沉**（`::first-letter` 衬线琥珀 3.4em）；blockquote 去 synthetic italic（中文发虚）改衬线正体。
- **页脚三件**：tags → mono `#标签` 文字流（`::before` 注入 #）；上一篇/下一篇 → 行式 hover（去边框卡）；相关文章区块头 → `相关文章 More ······`。

### 归档 / 关于 / 相册
- **归档**：月份头 `YYYY-MM ······ N 篇`（leader + 计数）；条目行式 `MM-DD 标题 →`（hover 微亮/右移/箭头），全页 reveal 级联。
- **关于**：`HELLO, I AM` mono kicker + **大号斜体署名**（呼应首页 hero）+ intro 改 mono；外链边框胶囊 → mono 文字流（`GitHub ↗`）；整卡 10 处 reveal 级联。
- **相册**：hover 图放大 + 整卡上浮 4px + 深阴影；标题改底部渐变遮罩滑出（mono 白字，圆角裁切）；lightbox 图片 0.94→1 缩放入场（CSS transition 加在 `.lb-fade` 上）。

### 验证基线
- `backend npm test` **85/85**；`site npm run check` **0 errors**；构建通过。本地验证：dist 直跑 + API_BASE=http://localhost:3000，首页/文章/归档/关于/相册全 200，8 张豆瓣图 URL 全 200。
- **本地服务启动**：backend `npm run dev`(:3000)、site 用**构建产物** `API_BASE=http://localhost:3000 node dist/server/entry.mjs`(:4321)、admin `npm run dev`(:5173)。

### 分类页 + 分类特色图（2026-08-15 上线）
- **分类总览页 `/category`**（`site/src/pages/category/index.astro`）：features-01-luma 风格暗色适配——透视网格背景（rotateX 62° 白线 + mask 渐隐）+ 卡片网格（桌面一排 3 个，中屏 2 列，移动 1 列）+ 卡片=左上 icon（12 种 SVG 按分类名关键词映射）+ 左下名称/计数 + hover 特色图浮现（scale 1.08 + 底部暗化）+ 琥珀光晕叠加 + 白字。
- **分类特色图**：backend `categories` 表加 `cover` 列（migrate.ts 幂等 ALTER）；admin/public categories API 均返回 cover；admin PUT 传 `cover`（显式清空传空串）；admin CategoryManager 支持 canvas 压缩上传（1280px JPEG 0.82，复用 `api.uploadPhoto`）+ URL 输入 + 行内预览/清除。
- 导航入口需后台「主题配置→导航菜单」手动加 `/category`。
- **已上线**（2026-08-15）：backend 4 文件 + site dist + admin dist 全量部署，PM2 v22 PATH 重启，线上 cover 迁移成功。

## 5c. 2026-08-16：About 页结构化名片块（spec/plan 见 docs/superpowers/）

- **backend**：settings 新增 `about_blocks`（JSON 数组，DEFAULT_SETTINGS 白名单，navMenu 同模式）；`/settings/public` 返回解析后 `aboutBlocks`（type 白名单 text/kv/quote/progress/marquee 过滤，字段校验留给前台）；测试 85→87。
- **admin**：SettingsPage 关于 textarea → 块编辑器（5 类型徽章+摘要+↑↓删、按类型表单、progress 实时百分比预览与前台同公式）；旧 `aboutContent` 不再展示但适配层透传保留（存量内容不丢）。
- **site**：about.astro 按 aboutBlocks 结构化渲染——kv=`label ······ value` leader dots 行式（link 仅 http/https 白名单，其它协议回退纯文本）、quote=斜体衬线+琥珀引号+mono 作者、progress=mono 大百分比+辉光细条+起止日期（日期区间自动算，`blockPercents` 预计算单次）、marquee=`role="marquee"`+8 份内容 translateX(-50%) 无缝滚动+两端 mask 渐隐；**空数组回退旧 aboutContent 空行分段**；全块 data-reveal 级联；统计换 StatBubbles `variant="plain"`（SSR 真值+水合 count-up，类名复用 .about-stats 旧样式）；hero 加 SCROLL 呼吸提示。
- **reader 修复**：视频/遮罩/SCROLL 提示在 reader.css 外部规则 display:none（GradientBlob 先例）；结构化块极简样式（细线 kv/琥珀引号/细进度条/marquee 26s）；reduced-motion 下 marquee 只静态显示一份（nth-child(n+2) 隐藏）。
- **视频主题联动**（非降级）：`syncVideo()` 监听 `mblog-theme-change`，reader 暂停 / normal 恢复播放；reduced-motion 照旧暂停。**视频背景按用户决定不做能力降级**。
- **坑新增**：@astrojs/compiler 对模板表达式内含 `\u{...}` 码点转义的 regex 字面量会误判表达式边界（map 收尾丢 `}`，check 报 ts(1005) 且产物非法）——**含 `\u{...}` 的 regex 必须放 frontmatter 常量**再在模板调用（about.astro EMOJI_RE 先例，勿改回内联）。

### 线上部署（2026-08-16 已部署 cs.mboker.cn）
- 部署内容：backend `settings.ts` + `misc.ts`（scp 覆盖）/ site dist（tar 替换 `/root/.openclaw/.../mblog/site/dist`）/ admin dist（tar 替换 `/var/www/cs.mboker.cn/admin`）。PM2 重启 mblog-site + mblog-api，验证 about 页 200、aboutBlocks 返回数组（线上暂无结构化块→回退旧文本）、admin 新 hash 生效。
- **⚠️ 复现 PM2 v18 事故**：`sudo /root/.nvm/.../pm2 restart --update-env` 直接跑 → sudo 默认 PATH 里 node 解析成 v18.19.1 → better-sqlite3 ABI 不匹配 ERR_DLOPEN_FAILED → 502。**正确姿势必须是 `sudo bash -c 'export PATH=/root/.nvm/versions/node/v22.22.2/bin:$PATH && pm2 restart mblog-api --update-env'`（sudo 内先 export 再重启）**——仅用 pm2 绝对路径不够，坑在于 sudo 会重置 PATH。
- **SSH 连通教训**：2026-08-16 本机 SSH 22 端口一度被腾讯云安全组拦截（ping 通、80/443 通、22 超时=包被丢弃）。放通本机 IP 后恢复。若再遇 502/连不上，先查安全组是否把 SSH 来源收窄了。
- 验证：backend 87/87、admin typecheck 0、site check 0 errors、双主题 dev 实测（reader 视频隐藏/normal fixed 播放、27% 进度与公式一致、javascript: 链接被拦）。本地 dev 库 `about_blocks` 已留 8 条演示块（text×1/kv×4/quote/progress/marquee），后台「站点设置→关于页内容」可改。
- 提交链：`6969db3`（backend）→ `08459f4`+`51f8353`（admin）→ `89e6951`/`057b1a0`/`707fa7c`/`e8f6037`/`dbaa145`（site 五连）→ `37a699f`（审查修复）。**线上未部署**（下次部署记得 site dist + backend settings.ts/misc.ts + admin dist）。

### reader 归档页排版修复（同日，已部署 `5ef2c6c`）
- 根因：reader.css 归档有两套样式——旧模板类名（`.month`/`.date`/`.posts-title-sm`，新 archive.astro 已无此结构=死代码）+ 新适配只覆盖部分类 → `.archive-month` 是 block（label/rule/count 三 span 内联挤排，rule 宽 0）、`.archive-row` 是 inline（date/title/arrow 混排，日期衬线非 mono）、残留旧 `.archive-group ul` 竖线与 li::before 圆点。
- 修复：reader 归档段重写——`.archive-month` flex + `.archive-month-rule` dotted leader + count；`.posts-list`/`.posts-item` 清 border-left/position/::before；`.archive-row` grid 三列（date mono / title display / arrow hover 滑入）；normal 主题零改动。**教训：normal/reader 双主题样式必须同步适配模板改版，类名级死代码容易残留。**

### reader 电台页极简适配（同日，已部署 `d067d0d`）
- 根因：RadioPlayer.vue 完整播放器只有 `[data-theme='normal']` 样式，reader.css 里 radio 相关 **0 条** → reader 下播放器/歌单完全无样式。
- 修复：reader.css 追加电台极简套——无卡播放器（grid 140px 封面 + 1fr，透明底）、EQ 动效 `readerRadioEq`（白底小条）、圆形细边按钮 + 赭红主按钮（`--color-primary` 实心白字）、细线歌单行式（active 9% 琥珀 + inset 指示条）、移动端 ≤640px 单列；**reader tokens 补 `--color-error: #a03a2a`**（之前缺失，`radio-play-err` 会失效）。线上验证：歌单 10 首正常加载、播放器样式全命中。
- 教训：新功能（如电台）上线时若不双主题适配，reader 会留下无样式页面——功能开发时就把双主题样式一起做。

### 电台 normal 播放器版式 + 歌词（同日，已部署 `cf4fbd0`/`1ad8fc2`/`c92a3db`）
- **backend**：`getSongLyric`（weapi `song/lyric`，lv/kv/tv -1）+ 公开路由 `/api/netease/lyric?id=`（无歌词返回空串）+ `test/netease.test.ts`（3 条路由校验层测试，不触网）→ 90/90。
- **site normal 分离式播放器**（用户选定）：`.radio-top`（200px 封面+琥珀辉光 / 信息+`.radio-controls-bar` 横条=按钮组+进度+音量，上细线分隔）+ `.radio-lyrics` 歌词屏（300px 滚动、LRC 解析缓存、active 琥珀放大+辉光、scrollIntoView center 滚动跟随）+ 歌单。**reader 保持现状**：`.radio-top` 140px 无卡两列、控制条 column 纵向、`.radio-lyrics { display:none }`。
- **坑（重要）**：歌词行 active 高亮用 `transition`（color/font-size 0.25s）时**逐秒切换的歌词行产生竞态**——高亮停留在过渡起点（灰色 15.5px）永不完成，font-weight 无 transition 立即生效 700（定位线索）；**去 transition 瞬时高亮即修复**。歌词高亮类规则不要加 transition。
- 部署踩坑：**scp 多文件同 basename 会互相覆盖**（两个 netease.ts 同名 → 后传的覆盖先传的）→ backend 源文件 scp 务必用不同目标名（如 netease-lib.ts/netease-route.ts）。
- 验证：线上歌单 10 首，歌词 62 行加载、active 琥珀 18px 高亮+辉光、滚动居中（offset 27px）、reader 歌词隐藏+原版式、API 返回 1521 字符 LRC。

### hero 视频渐隐融合迭代（同日，用户反馈"整页视频与全站气质割裂、导航区黑块"）
- **结构**：视频从 fixed 整页改为 `.about-hero` 内 absolute（随滚动离场）；去 `.about-cinema` 容器；下方内容包 `.about-body`（relative + 720 版心 + `<GradientBlob />`，与 posts/archive 同款辉光）。
- **主题融合**：视频 filter 暖调琥珀（sepia .32/hue-rotate -12deg/brightness .62）；遮罩**顶+底**都渐隐到 `var(--color-bg)`（顶边保证滚动时透明 sticky 顶栏下与其它页观感一致——修复「导航区黑块」）；下方 kv/quote/progress/marquee/stats/links 白 rgba 全换 `--color-text*`/`--color-border`。
- **黑块根因**：IAB/标签页隐藏时浏览器自动暂停视频且无人恢复 → syncVideo 增加 `visibilitychange` 监听（重新可见+normal+非 reduced 时恢复播放）。主题切换联动不变。
- 坑：normal 顶栏 `.site-header` 是 **transparent sticky**（z100），内容永远从其下穿过——整页异色媒体会在 pill 胶囊两侧形成色带；hero 文字需 `position:relative; z-index:2` 压过 absolute 视频/遮罩。`.theme-toggle` 按钮全站有 2 个（PillNav + 隐藏 MobileHeader），role 定位点击可能 flaky。

## 6. 待办 / 下一步

- **线上部署验证**（2026-08-15 已部署，复查 cs.mboker.cn 三页 + 豆瓣图 + PM2 日志）
- **既有 astro check 6 错误**（og Buffer / post updatedAt / Element 类型）：装 `@types/node` + post 内联 script 加 `as HTMLElement`（可选清理，当前 0 errors 是 grep 过滤结果，完整 `npm run check` 仍有 hints）
- **后台关于页**：如果用户要 eonova 结构化区块（我是谁/性格/星座/爱好/引用/进度条）需后台结构化字段（目前纯文本分段 + emoji）
- **.gitignore**：`docs/prompts/`、`admin-pure/`、`.zcode/`、`._prod_home.html` 建议忽略（可选）
- **TMDB 直链**：首页豆瓣 8 图中有 2 张 `image.tmdb.org` 直链，国内网络若被墙不显示，可把 TMDB 域名加进 backend `cover.ts` 代理白名单
- 相册图片/OG 图 CJK 字体部署验证
- admin-pure/ 目录处置（占空间）

## 7. 已知坑（踩过，别再来一遍）

1. **Astro template `${}` 插值**：class 必须用模板字符串，不能字面 `{cond ? a : b}`
2. **grid 溢出**：`minmax(0,1fr)` + `min-width:0`；inline code `overflow-wrap:anywhere`
3. **Astro named slot 必须组件直接子级**：包在条件 Fragment 里会失效（TOC 丢失事故）——slot 内容放 BaseLayout 直接子级
4. **Vue scoped style 里 `:global(...)` 编译会破坏整个 scoped 块**（GradientBlob 事故 → reader 页面空白）：跨主题隐藏用主题 CSS 外部规则，别在组件 scoped 用 :global
5. **Astro island `<astro-island>` wrapper 破坏父级 flex/grid 布局**：给容器加 `display:contents`（气泡 StatBubbles 事故）；`[data-theme='normal'] .nh-hero astro-island { position:absolute }` 会误伤所有 hero 内 island
6. **双套菜单结构**：`.site-nav > .site-nav-menu > a` 多一层 div，父级 `gap` 失效——`.site-nav-menu` 需透传 gap（reader 16px）
7. **IAB 浏览器自动化**（cua/playwright click/evaluate）不稳定——用 DOM/locator 检查代替；evaluate 只读被拒
8. **Windows 路径**：Git Bash 用 forward slashes；python 读不到 /tmp（用仓库内路径）；curl 传中文 JSON 用 python json.dumps（shell 转义易错）
9. **上传相对路径**：`/admin/upload` 返回 `/uploads/...`，createPhoto 校验需接受 `^(https?://|/)`；前台渲染相对 url 要拼 API_BASE
10. **测试断言同步**：public settings 拆分 navMenuNormal/Reader 后 posts.test.ts 断言必须同步（当前 83/83）
11. **后台 col 结构**：往卡组插卡片时注意 left col 闭合 `</div>` 别被替换卷走（导航卡事故）；卡片间距统一 `card mb-4`
12. **settings 白名单**：新增设置 key 必须加 DEFAULT_SETTINGS，否则 PUT 静默丢弃
13. **密码/密钥掩码**：MASKED_KEYS 占位符保留原值
14. **backend 登录路径**：`/api/admin/login`（不是 /auth/login）
15. **mblog_theme key 前台/后台值域冲突**（已修复 2026-08-12）：后台改 `mblog_admin_theme`，前台 `mblog_theme` 只存 normal/reader；**前台 ThemeToggle 应用 localStorage 前必须校验**，别再把后台主题值当双主题套用
16. **构建产物无 Vite /api 代理**（2026-08-15）：`astro.config.mjs` 的 `/api`、`/uploads` proxy 只在 `npm run dev` 生效；`node dist/server/entry.mjs` 直跑时相对路径图全 404（首页豆瓣海报事故）。**前台渲染任何相对媒体路径（/api/cover、/uploads）都必须 absUrl 拼 API_BASE**（gallery.astro 老规矩，首页/文章页已补）。API_BASE 环境变量同时影响图片加载
17. **移动端 topbar 与 hero 负 margin**：`.nh-hero` 桌面 `margin-top:-57px` 是为钻进桌面顶栏；移动端顶栏是 MobileHeader（文档流内 sticky），负 margin 会把首屏文字顶进顶栏底下被挡住——**移动端归零**（`@media(max-width:768px) .nh-hero{margin-top:0}`）
18. **SSR 缓存只进服务端**：`api.ts` 缓存 Map 用 `typeof window === 'undefined'` 门控，否则浏览器端 island 会拿到陈旧数据

## 8. 事故记录（重要！）

### 2026-08-12 —— reader 主题所有用 PageHeader 的页面空白（GradientBlob :global）
**现象**：在 GradientBlob.vue scoped style 加 `:global([data-theme='reader']) .gradient-blob { display:none }` 后，reader 下 friends/projects/douban/posts/archive/talk 全部 main 高度/宽度塌成 0（空白）；首页正常（reader-home 不经 .posts-page）。
**根因**：Vue 编译 scoped 内 `:global` 时破坏整个 scoped 块，`.gradient-blob` 的 `position:absolute` 失效，辉光回归正常流 + `filter:blur(70px)` 撑塌 grid 第二列。
**修复**：移除组件内 :global，改 reader.css 外部规则 `[data-theme='reader'] .gradient-blob { display:none }`（外部 CSS 不干扰 scoped 编译；scoped 未声明 display 不被覆盖）。已提交 b1fca22。
**教训**：跨主题隐藏/覆盖用主题 CSS 外部规则，别在组件 scoped 里用 :global。

### 2026-08-12 —— TOC 目录丢失（Fragment slot 嵌套）
**现象**：文章页右侧目录（LineSidebar）消失。
**根因**：404 条件用外层 `<Fragment>` 包文章内容，`<Fragment slot="toc">` 嵌套在内 → Astro named slot 必须组件直接子级，嵌套失效。
**修复**：toc slot 移到 BaseLayout 直接子级（`{post && toc.length>0 && <Fragment slot="toc">...}`）。
**教训**：named slot 永远放组件直接子级。

### 2026-08-11 历史事故（原记录，仍有效）
- admin 目录被 pure-admin-thin 覆盖（git checkout/clean 恢复）
- Node v20→v24 better-sqlite3 ABI（降级 v12）
- 并行会话 Tabler 换肤（路径修正）
- Gemini UI 接入完成（terrenceftz/mblog-ui）

## 9. 生产部署（cs.mboker.cn，2026-08-12 实勘）

> ⚠️ **重要**：线上域名走宿主 Nginx + PM2 进程 + /var/www 静态文件，**不是** docker-compose 那套（docker 栈 3000/4321/8082 是 agent 部署的另一套，域名不经过它）。

- **服务器**：49.235.112.36（腾讯云），用户 **ubuntu**；SSH 私钥 `ssh812.pem`（**在桌面**，2026-08-12）
- **宿主 Nginx**（80/443，Let's Encrypt）：`/etc/nginx/sites-available/cs-mboker-cn`（sites-enabled 软链）
  - `/admin/` → **alias** `/var/www/cs.mboker.cn/admin/`（Vite 构建产物拷贝部署，不是容器！）
  - `/api/` → `localhost:3003`；`/uploads/` → `localhost:3003`；`/` → `localhost:4322`
- **进程**：PM2 跑 backend（:3003，mblog-api）和 site（:4322，mblog-site）；代码在 `/root/.openclaw/workspace/agent-e7b30f31/mblog`（**非 git 仓库**，agent 拷贝部署）。site 用 `API_BASE=http://localhost:3003` 启动（服务器内网地址）
- **缓存策略（2026-08-12 修复）**：`map $uri $mblog_cache_control` → `/admin/assets/`、`/_astro/` immutable 1 年；`/uploads/` 86400；其余（HTML/API）no-cache。仓库内 `deploy/nginx/sites-available/cs-mboker-cn.conf` 即线上实际配置，`deploy/nginx/nginx.conf` 是 docker 等价版
- **外部数据接口（豆瓣/GitHub）永不阻塞**：`/api/douban`（豆瓣抓取+TMDB 逐部，300 部级耗时分钟）、`/api/projects`（GitHub 10s 超时）都是 30min 内存缓存 + stale-while-revalidate——过期/冷启动立即返回旧数据或空（`stale:true`/`syncing:true`），后台单飞刷新；首页 SSR 靠它们兜底不再卡死。**冷启动后 douban 抓取需 1~2 分钟才同步完，期间首页豆瓣为空属正常**
- **部署步骤（2026-08-15 实操验证）**：本地 `site` 构建 → `tar -cf /tmp/site-dist.tar -C dist .` → `scp` 到服务器 `/tmp/` → `sudo mv site/dist site/dist.bak && sudo mkdir site/dist && sudo tar -xf`；backend 源码改动（如 stats.ts）直接 `scp` 覆盖对应文件 → `sudo export PATH=/root/.nvm/versions/node/v22.22.2/bin:$PATH && pm2 restart mblog-site mblog-api --update-env` → 验证
- **⚠️ PM2 重启必须带 v22 PATH**（2026-08-15 事故）：`pm2 restart --update-env` 会刷新进程 env，若在默认 PATH 下执行，node 解析成系统 v18.19.1 → backend 的 better-sqlite3（NODE_MODULE_VERSION 127）ABI 不匹配 `ERR_DLOPEN_FAILED` → 502。**重启前必须 `export PATH=/root/.nvm/versions/node/v22.22.2/bin:$PATH`**（线上 node 实际是 v22.22.2，pm2 二进制也在同目录）。pm2 命令：`/root/.nvm/versions/node/v22.22.2/bin/pm2`
- **媒体 URL 架构**：`API_BASE`（服务器内网 localhost:3003）只用于 SSR 内部 fetch，**绝不能拼进 HTML 给浏览器**（用户会请求自己机器）。渲染给浏览器的相对路径 `/api`、`/uploads` 走 nginx 同域反代；本地直跑 dist 需另设 `PUBLIC_API_BASE=http://localhost:3000`（index/post/gallery 的 absUrl 逻辑）
- **坑**：Nginx `try_files` 按 root+$uri 拼路径、与 alias 冲突；`alias`+正则 location 无捕获组会 301 加尾斜杠——admin 资源拆分缓存不要用正则+alias，用 map 按 $uri 分发

## 10. 参考
- 灵感：https://eonova.me（关于页名片式参考）源码 https://github.com/eonova/eonova.me
- Reactbits 组件移植（border-glow / pill-nav / blur-text / liquid-ether / line-sidebar / **masonry**）
- 已装 skill：web-design-guidelines、ui-inspiration-triad、ui-ux-pro-max 等
- 历史 spec/plan 在 `docs/superpowers/`
