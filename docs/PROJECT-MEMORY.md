# MBLOG 项目记忆文档（会话交接）

> 最后更新：2026-08-11 深夜（Gemini UI 接入完成 + 设置页整理，明日继续）
> 用途：跨会话记忆，供明天继续开发使用。开发前先读本文件 + `git log --oneline -20`。

---

## 0. 环境（2026-08-11 定稿）

- **Node v24.19.0**（winget OpenJS.NodeJS.LTS）+ **pnpm 11.21**（corepack enable）。旧 Node 20.16 无法装回（node.exe 被 ZCode 占用，MSI 1603）。**保持 Node 24**。
- **better-sqlite3 = ^12.11.1**（最终版本，有 Node 24 prebuild；**不要升 v13**——v13 无 prebuild 需 VS 工具链编译必失败）。后端重装依赖后务必 `npm test` 验证（当前 83/83 通过）。
- site（Astro + sharp 0.34）在 Node 24 下正常。
- 坑：MSI 替换 node.exe 前必须停所有 node 进程；Windows 下 npm 脚本用 cross-env 写环境变量；pnpm 11 的 build 许可在 `pnpm-workspace.yaml` 的 allowBuilds。
- 后台 dev server 目前由 ZCode 会话后台托管（5173 端口，日志 /tmp/admin-dev3.log）；后端 tsx watch 3000；site astro 4321。



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

**Gemini 生成 UI（2026-08-11 接入，全部页面已接真实后端）**：AdminLayout（navbar-vertical 侧栏 + page-wrapper + 主题三态切换）、Login（blob 玻璃拟态 + 用户名/密码）、Dashboard、PostList、PostEditor（真实 Vditor）、CategoryManager、TagManager、CommentManager、TalkManager、FriendLinkManager、SettingsPage（7 卡）、ThemesPage（配色细节 + 实时预览）

### 关键约定

- **设计体系**：Gemini 的 `--mb-*` 变量体系（`src/styles/admin.css`，@import tabler 1.4 + Bootstrap 5.3.7）。**自定义样式用 --mb-primary/--mb-bg-* 等**（看 admin.css 顶部定义），不用旧的 --bg/--surface token（已废弃但 CSS 里残留无害）
- **API 适配层** `src/api/admin.ts`：Gemini 的 `api.xxx()` 方法签名 + 类型，实现接真实后端（fetch 封装 `src/api/client.ts`）；字段映射（postCount←postTotal、created_at 格式化、archived→draft、spam→rejected）；真实后端类型在 `src/api/posts.ts`
- **主题机制** `src/lib/theme.ts`：`mblog_theme` key（dark/light/system 三态），兼容旧 `admin_theme` 一次性迁移；`<html>` 双属性 `data-theme` + `data-bs-theme`；index.html 内联防闪白脚本同逻辑
- **主题切换器**：AdminLayout 侧栏底部三按钮（浅色/暗色/跟随系统）
- **Toast**：`src/lib/toast.ts`（toast.success/error/warning 风格）+ `ToastContainer.vue`（在 AdminLayout 内，登录页无容器）
- **PostEditor**：真实 Vditor（wysiwyg，工具栏含图片上传 + 音频插入按钮）、封面上传、**草稿自动保存**（localStorage `mblog_admin_draft_${new|edit_${id}}`，3s 防抖）、离开确认（window.confirm）、字数统计、TagPicker（el-select 风格多选）
- **TalkManager**：compose 发布框（450/500 字数变色提示）；talk 发布者=作者，直发免审核；删除走 DELETE /talks/:id（后端 2026-08-11 新增）
- **Dashboard**：统计卡（postCount/commentCount/todayViews/待审核）+ 快捷操作 + 最新评论/说说列表（真实数据）
- **设置页**：7 卡结构（站点基础信息含博主名称/头像、存储与上传、评论验证 Turnstile、前台功能、导航菜单、修改密码、豆瓣同步）；密钥掩码 '********' 表示不变
- **博主信息**：settings.author（博主名称）/settings.avatar（博主头像）是前台首屏数据源（后台设置卡唯一入口，主题页无头像输入）
- 分页响应 `{ list, total }`；Gemini 版列表页拉全量 pageSize=100（无分页 UI，文章超 100 需补）

### 已知修复模式（避免回退）

- 侧栏高度自适应：内容超出视口时内部滚动（`overflow` 处理）
- 设置页：双列 grid + field-pair + card--full 等高布局
- 登录页：暗色卡片 + blob 背景 + 密码显隐

## 5. 今日已完成的工作（2026-08-11，按时间线）

**上午-下午（旧会话）**：
- 后台 UI 精修 + 浅色双主题（2c871fb）、仪表盘增强（0fe6972）、web-design-guidelines 审计修复

**今天主线的三个大阶段**：
1. **pure-admin 迁移（尝试→暂停）**：环境升级 Node 24 + pnpm、thin 模板落地到 `admin-pure/`、基础设施对接、10 个 EP 页面写完（typecheck/build 通过）。**因用户改选轻量方案而暂停**，`admin-pure/` 目录保留未提交（untracked）。
2. **Tabler 换肤（完成，c6af9a9~124812c）**：引入 @tabler/core 1.4（内置 Bootstrap 5.3.7）全局换肤——admin.css 先加载 + Tabler 后加载接管 .card/.btn/.table/.badge；data-bs-theme 暗色联动；琥珀主色覆盖（--bs-primary 族）；AdminLayout 改 navbar-vertical 侧栏 + page-wrapper；10 页面类名适配（soft badge/form-control/pagination）。
3. **Gemini UI 接入（完成，e4f55b8~e4fcec9）**：用户让 Gemini 按提示词（docs/prompts/admin-ui-gemini.md）生成了完整后台 UI（仓库 terrenceftz/mblog-ui），全量接入：
   - **API 适配层**（admin/src/api/admin.ts）：保留 Gemini `api.xxx()` 签名与类型，实现接真实后端 + 字段映射（postCount←postTotal、views←viewCount、created_at 格式化、archived→draft、spam→rejected、postTitle 拉文章标题）
   - 12 个视图 + components + admin.css（--mb-* 设计体系）全用 Gemini 版；真实类型在 src/api/posts.ts
   - 路由/链接适配：dashboard 路由、/posts/:id、/friends
   - PostEditor：Gemini 布局 + **真实 Vditor**（上传/暗色联动/离开确认/封面上传）+ **草稿自动保存**（3s 防抖 localStorage）+ **音频插入**（工具栏按钮）
   - 功能补全（46a7044）：SettingsPage 补 Turnstile/友链/GitHub/导航/存储/改密码；ThemesPage 补配色 5 色/头像/简介；后端 +DELETE /talks/:id；friendLinks POST 修正
   - **设置页整理**（e4fcec9）：10 卡合并为 7 卡（删 SEO/ICP/keywords，API 密钥并入存储卡，友链+GitHub 合并为前台功能卡）
   - **博主名称/头像与前台首屏打通**（ca6ae2d）：后端 DEFAULT_SETTINGS +author/avatar + public settings 返回；前台 hero 名称/头像优先读博主设置；主题页移除重复头像入口
   - **头像已上传**：/uploads/1786451490681-2d99db44-eba1-4e06-850f-3621cdfe1646.jpg 已写入 settings.avatar（用户桌面图片）

**并行会话事故**：GLM 会话（另一窗口）曾误判 Tabler 覆盖为事故回滚（17:53 记录），后并行做 Tabler 引入已合并；better-sqlite3 由 GLM 降级为 v12（cd844fb）。

**当前提交链**（工作区干净，仅 untracked：.zcode/ admin-pure/ docs/prompts/）：
`e4fcec9`（设置页整理）→ `ca6ae2d`（博主打通）→ `46a7044`（功能补全）→ `400334c`（Gemini 全量接入）→ `e4f55b8`（适配层）→ `c6af9a9~124812c`（Tabler 换肤）→ `2c871fb`（UI 精修）

## 6. 待办 / 下一步

**明日优先**：
- **验收 Gemini UI**：浏览器 5173 逐页过一遍（登录→10 页面→暗/浅主题切换→Vditor 编辑/上传→草稿恢复→设置保存→豆瓣同步），发现细节问题再调
- **博主名称**：settings.author 目前为空（头像已设），用户需在后台填名称或确认默认
- 设置页/主题页保存后**刷新前台验证**（site 4321）：首屏头像、主题配色、默认主题、导航菜单、GitHub/友链开关
- admin-pure/ 目录处置：确认保留或删除（占 ~大量 node_modules 空间）

**已知剩余打磨项**：
- 暗色下表格 hover/焦点细节、TagManager 胶囊样式微调（Tabler 时代遗留）
- PostList 行点击进编辑、tabular-nums（更早遗留）
- Gemini 版 PostList 无分页（拉全量 100 条）——文章超 100 后需加分页
- CommentManager postTitle 通过适配层拉文章标题映射（已有，验证准确性）

**长期**：eonova low-priority 项、OG 图 CJK 字体部署验证、说说前台互动（未定）

## 7. 已知坑（踩过，别再来一遍）

1. **Astro template 里 `${}` 插值**：`class="a {cond ? b : c}"` 会输出字面量，必须 `` class={`a ${cond ? b : c}`} ``
2. **移动端横向溢出**：grid item 默认 `min-width:auto` → 用 `minmax(0,1fr)` + `min-width:0`；inline code 加 `overflow-wrap:anywhere`
3. **Grid 自动放置错位**：TOC 等要显式指定 grid-row/grid-column
4. **PillNav 折叠**：主题切换后必须重算（见上）；`getClientRects().length===0` 分支
5. **`router-link-active` 前缀匹配**：`to="/"` 会常亮，需自定义 `isActive()`
6. **IAB 浏览器自动化**（cua/playwright click）不稳定，交互验证可能失败——用 DOM/hydration 检查代替，别浪费时间；IAB 的 evaluate 只读（localStorage 读取会被拒）；dom_cua 的 node_id click 可能不生效，用 cua 坐标 click
7. **Windows 路径**：Git Bash 下用 forward slashes；**python 读不到 /tmp**（MSYS 虚拟路径）——python 处理文件用仓库内路径或临时文件放 Windows 真实路径
8. **Settings 卡片**：改布局时别误粘贴重复卡片（发生过一次）；**python 批量改 Vue 模板后必查 div 配平**（本次 10 卡合并时丢 5 个闭合标签，编译 500）
9. **测试断言**：分页 shape 改 `{list,total}` 后，admin.test.ts:304/361、stats.test.ts:38 必须同步
10. **字体/样式改动**：永远带 `[data-theme='normal']` 前缀，别碰 reader
11. **后台 settings 白名单**：后端 admin PUT /settings 只接受 DEFAULT_SETTINGS 里的 key（lib/settings.ts）——新增设置字段必须先加 DEFAULT_SETTINGS，否则静默丢弃
12. **vite 裸导入解析**：`import 'tabler/dist/css/...'` 包名写错会 Failed to resolve（正确 @tabler/core）；vite 启动后才 npm 装的包需重启 dev server 才能解析
13. **后端 settings 掩码**：MASKED_KEYS（cos_secret_key/tmdb_api_key/turnstile_secret_key）GET 返回 ********，PUT 收到占位符保留原值

## 8. 事故记录（重要！）

### 2026-08-11 17:53 —— admin 目录被 pure-admin-thin 模板整体覆盖

**现象**：后台 dev server 无故崩溃，报 EPERM（`.vite/deps_temp → .vite/deps` rename 失败）；`git status` 出现大量 `M`/`D`，`package.json` 变成 vue-pure-admin-thin 的（element-plus/pinia，dev 脚本是 pnpm 风格 `NODE_OPTIONS=… vite`，Windows cmd 下跑不起来）。

**根因**：admin 目录被外部操作整体覆盖为 pure-admin-thin 模板（发生在 vite.config.ts 变化触发的重启时刻）。非本会话操作，疑似其他窗口误解压。覆盖期间 node_modules 被 pnpm 重装成 pure-admin 依赖集（vite 7 + `.pnpm` 结构）。

**恢复命令（已验证）**：
```bash
git checkout -- admin/   # 恢复所有 M/D 文件（我们的代码全部在 HEAD 里）
git clean -fd admin/     # 删除 pure-admin 的 untracked 残留（layout/store/views/login 等）
rm -rf admin/node_modules admin/.vite   # 清掉 pnpm 依赖集 + 损坏缓存
cd admin && npm install   # 按恢复后的 package.json 重装（vite 6）
npm run dev               # 重启（脚本是纯 vite，无 NODE_OPTIONS）
```

**额外注意**：覆盖期间可能有并行会话提交（如 2c871fb "后台 UI 精修 + 浅色双主题"），checkout 恢复到含该提交的 HEAD，工作区最终与 HEAD 一致，未丢失任何代码。

### 2026-08-11 18:33 —— Node v20→v24 迁移，better-sqlite3 ABI 崩溃

**现象**：后端 dev server 重启时 `better-sqlite3` 报 `NODE_MODULE_VERSION 115 / requires 137`（ERR_DLOPEN_FAILED），三端全挂（site 的 SSR 请求后端超时达 170s）。

**根因**：系统 Node 从 v20.16.0 切换为 v24.19.0（`C:\Program Files\nodejs` 被升级），原生模块 ABI 不匹配；同时并行会话将 better-sqlite3 升级到 **v13.0.3**（v13 移除了 prebuild-install，强制 node-gyp 源码编译，而本机**没有 VS 编译工具链**，编译必失败）。

**修复（已验证）**：降级到有 Node 24 prebuilt 的 v12 系列，prebuild-install 自动下载二进制，无需编译：
```bash
cd backend && npm install better-sqlite3@^12.11.1
npm test   # 83/83 通过
```
**教训**：本机（HUAWEI 机器）无 VS Build Tools + 有 Python 3.12——任何需要 node-gyp 编译的原生依赖升级都会失败；优先选有 prebuilt 的版本（better-sqlite3 用 v12.x 不要用 v13.x，sharp 无碍）。

**环境变更记录**：Node 版本现在是 v24.19.0（v20 时代的旧二进制都会失效，装原生依赖后务必 `npm test` / 手动 require 验证）。

### 2026-08-11 18:48 —— 并行会话引入 Tabler 换肤（admin）

并行会话（另一个窗口）给后台引入 **Tabler（@tabler/core ^1.4 + @tabler/icons ^3.46）** 全局换肤：main.ts 里 admin.css 先加载（自定义 token），Tabler 后加载接管 `.card/.btn/.table/.badge` 组件样式。其改动未提交（工作区 M：main.ts/theme.ts/admin.css/package.json/index.html）。

**我做的修复**：它写的 `import 'tabler/dist/css/tabler.min.css'` 路径错误（裸包名不存在，应为 `@tabler/core/...`），已改为 `@tabler/core/dist/css/tabler.min.css`；并 `npm install` 补装依赖。dev server 恢复正常。

**注意**：5173 上跑的是并行会话的 vite 实例（会热更新）。继续开发时如果并行会话还在，**别抢端口、别覆盖它的未提交改动**；tabler 换肤若有样式冲突，在 admin.css 里调整优先级。

**防御**：若再出现 dev server EPERM 崩溃 + package.json 异常，先 `git status` 检查 admin 是否被覆盖；`.zcode/`（仓库根）是 ZCode 工具目录，**永远不要删**。

### 2026-08-11 19:00 —— 后台 Tabler 换肤完成（轻量方案落地）

用户放弃 pure-admin 全量迁移（太重），改为**现成 CSS 皮肤直接复用**：引入 **Tabler 1.4（@tabler/core，内置 Bootstrap 5.3.7）**，在现有 Vue 结构上换肤，未动业务逻辑。提交链：`c6af9a9`（基础）→ `897848d`（布局）→ `64a2210`（10 页面）→ `124812c`（TagPicker）。

**关键技术约定**：
1. **CSS 加载顺序**：`main.ts` 里 admin.css 先、`@tabler/core/dist/css/tabler.min.css` 后——Tabler 接管 `.card/.btn/.table/.badge` 等组件样式，自定义 token 管颜色
2. **暗色机制**：`theme.ts` 的 `applyTheme()` 同时设置 `<html data-theme>`（自定义 CSS）和 `<html data-bs-theme>`（Bootstrap/Tabler 暗色）；index.html 内联防闪白脚本同样双属性
3. **琥珀主色**：admin.css 顶部"Tabler 琥珀主题适配"区块覆盖 `--bs-primary`/`--bs-primary-rgb`/`.btn-primary` 的 `--bs-btn-*` 变量族（暗色 #e8b64c，浅色 #c28721 保 AA）
4. **组件结构约定**：Tabler `.card` 必须包 `.card-body` 才有内边距；徽章用 soft 变体（`bg-success-soft`/`bg-warning-soft`/`bg-danger-soft`）；输入框 `.form-control`、下拉 `.form-select`；分页用 `.pagination` + `.page-item/.page-link`
5. **布局**：AdminLayout 用 Tabler `navbar-vertical` 侧栏结构（保留自定义移动端抽屉 + 主题三态切换）；主区 `page-wrapper > page-body > container-xl`
6. **并行会话**：GLM 会话也做了 Tabler 引入（方向一致，已合并）；**不要重复引入 tabler 依赖或重复改 main.ts 导入**

**注意**：Login.vue 是 GLM 的全自定义设计（无 Tabler 类），保持不动。

### 2026-08-11 20:30 —— Gemini UI 接入完成（mblog-ui 仓库）

用户让 Gemini（基于 prompts/admin-ui-gemini.md 提示词）生成了完整后台 UI，仓库 https://github.com/terrenceftz/mblog-ui，已全量接入 admin/。提交：`e4f55b8`（基础+适配层）→ `400334c`（全量接入）。

**接入方式（关键）**：
1. **Gemini 提供视觉**：views/*（12 个）+ components/* + styles/admin.css（--mb-* 设计体系 + @import tabler）+ lib/toast.ts（toast.success() 风格）+ App.vue（onMounted initTheme）
2. **我们提供数据**：`src/api/admin.ts` = **API 适配层**——保留 Gemini 的 `api.xxx()` 方法签名与类型（页面模板依赖），实现全部调用真实后端（fetch 封装 client.ts），并做字段映射：postCount←postTotal、views←viewCount、created_at←fmtTime(createdAt)、status（archived→draft、spam→rejected）、postTitle 拉文章标题映射
3. **真实类型**在 `src/api/posts.ts`（CategoryRow/TagRow/CommentRow/FriendLinkRow/AdminPostRow/AdminPostDetail/PostPayload/TalkRow）
4. **路由/链接适配**：router 用我们的（history 模式 + admin_token 守卫）；dashboard 路由从 path:'' 改为 path:'dashboard' + 根路径 redirect（Gemini 导航全是 /dashboard）；链接 /posts/edit/* → /posts/*；/friend-links → /friends
5. **PostEditor**：Gemini 布局 + **真实 Vditor**（mock textarea 替换；上传 /api/admin/upload + Bearer、input→postForm.content、data-bs-theme 联动 vditor.setTheme、window.confirm 离开确认、封面上传按钮）
6. **主题**：theme.ts 用 mblog_theme key（兼容 admin_theme 一次性迁移）+ data-theme/data-bs-theme 双属性；index.html 防闪白脚本同逻辑

**注意**：
- Login.vue 是 Gemini 的 blob 玻璃拟态设计，补了用户名输入框（后端要 username+password）
- admin.css 是 Gemini 的 --mb-* 体系（与我们旧 --bg/--surface token 不同），**自定义新样式时用 Gemini 的变量**（--mb-primary 等，看 admin.css 定义）
- 编辑器 vditor 依赖保留在 package.json（vditor ^3.10.9）

### 2026-08-11 21:00 —— Gemini UI 功能补全（46a7044）

用户要求核对所有页面，把 Gemini 遗漏的旧功能补齐：

**补全清单**：
- SettingsPage：+6 卡片（Turnstile 评论验证/友链开关/GitHub 展示/导航菜单动态行/存储+COS/修改密码）+ 基础信息补默认主题/站点地址；适配层 getSettings/updateSettings 全字段映射（含掩码约定）
- ThemesPage：+配色细节 5 色（bg/text/muted/primary/border color picker，normal/reader 各自维护）+ 首屏头像/自我介绍（normal 主题）+ 色板选择联动写入 primary；适配层 getThemeConfig/updateThemeConfig 读写 theme_normal/theme_reader JSON
- PostEditor：+localStorage 草稿自动保存（3s 防抖，mblog_admin_draft_ 键，保存成功清除）+ Vditor 工具栏音频插入按钮
- 后端：+DELETE /talks/:id（适配层 deleteTalk 真实调用）；friendLinks 后端本就有 POST（适配层误判，已修正支持后台手动添加友链）
- 核对确认已有：CommentManager 回复/批量/状态、TalkManager 450/500 字数提示、PostList/Category/Tag 删除确认

**SiteSettings/ThemeConfig 类型扩展**（api/admin.ts）：新增 siteUrl/defaultTheme/turnstileSiteKey/turnstileSecretKey/friendLinkEnabled/githubEnabled/githubUsername/navMenu/storageProvider/cosBucket/cosRegion + ThemeConfig.colors{normal,reader}

## 9. 参考

- 灵感/借鉴：https://eonova.me 源码 https://github.com/eonova/eonova.me
- Reactbits 组件移植（border-glow / pill-nav / blur-text / liquid-ether / line-sidebar / gradual-blur(已移除)）
- 已安装 skill：`web-design-guidelines`（C:\Users\HUAWEI\.agents\skills\web-design-guidelines）、`ui-inspiration-triad`、`ui-ux-pro-max` 等
- 历史 spec/plan 在 `docs/superpowers/`（typography、douban、theme 等）
