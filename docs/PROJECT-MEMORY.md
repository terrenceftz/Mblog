# MBLOG 项目记忆文档（会话交接）

> 最后更新：2026-08-12（相册 / 关于页 / 双主题菜单 / GitHub 推送 Mblog）
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

**当前提交链**：`0ef6f8f`（docs README + 名片式 + 后台修复）→ `b76756e`（相册 + 关于后台 + 双主题菜单）→ `33df582`（reader prev/next）→ `b1fca22`（reader 空白修复）→ `796aa1e`（首页视觉 + 文章页 + reader 回归）→ `e6e4514`（normal 全面优化）→ `319a081`（上一版记忆）

## 6. 待办 / 下一步

- **验收**：相册上传→前台瀑布流、关于页名片式、双主题菜单（后台主题配置切 Normal/Reader 编辑 → 前台切主题看侧栏）、首页动效
- **既有 astro check 6 错误**（og Buffer / post updatedAt / Element 类型）：装 `@types/node` + post 内联 script 加 `as HTMLElement`（可选清理）
- **后台关于页**：如果用户要 eonova 结构化区块（我是谁/性格/星座/爱好/引用/进度条）需后台结构化字段（目前纯文本分段 + emoji）
- **.gitignore**：`docs/prompts/`、`admin-pure/`、`.zcode/` 建议忽略（可选）
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

## 9. 参考

- 灵感：https://eonova.me（关于页名片式参考）源码 https://github.com/eonova/eonova.me
- Reactbits 组件移植（border-glow / pill-nav / blur-text / liquid-ether / line-sidebar / **masonry**）
- 已装 skill：web-design-guidelines、ui-inspiration-triad、ui-ux-pro-max 等
- 历史 spec/plan 在 `docs/superpowers/`
