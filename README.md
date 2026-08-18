# MBLOG — 轻量个人博客系统

前后端分离的个人博客系统，三端独立部署：**Astro 前台 + Vue 后台 + Hono API**。支持双主题（暗色科技风 / 极简阅读）、瀑布流相册、后台可编辑的关于页、Markdown 富文本写作、评论审核、友链申请、GitHub 项目同步与豆瓣影音展示。

---

## ✨ 特性

**双主题体系**
- **normal**：暗色科技风主视觉（Playfair 衬线 + 琥珀主色 + WebGL 流体背景 + 卡片辉光）
- **reader**：极简阅读主题（浅色、无装饰、专注文字）
- 两套主题各自拥有**独立的导航菜单**，可分别定制
- View Transitions 圆形扩散主题切换；主题色/字号/首页文章数后台可配

**内容与交互**
- 📝 **写作**：Vditor 富文本编辑器（WYSIWYG + Markdown），图片/音频上传、封面上传、草稿自动保存（localStorage）
- 🖼 **相册**：瀑布流展示（reactbits Masonry 移植，GSAP 入场 + 点击 lightbox 放大），后台管理（上传自动压缩至 1600px / 外部 URL / 改标题 / 删除）
- 👤 **关于页**：后台编辑内容，eonova 名片式分段展示（段首 emoji 自动识别为区块标签）
- 💬 **评论**：Cloudflare Turnstile 云验证（未配置回落数学验证码），两级回复 + 审核，**新评论/博主回复可选邮件（SMTP）通知**
- 🔗 **友链**：前台申请 + 后台审核，支持头像
- 📁 **项目**：GitHub 公开仓库自动同步
- 🎬 **影音**：豆瓣已看 + TMDB 海报图源
- 💭 **说说**：短动态，作者直发免审核
- 🖼 **相册分组**：照片可归入相册分组，前台按组分段展示，后台可筛选/改组
- 🔎 **搜索**：SQLite FTS5 全文搜索（中文逐字分词）
- 🗂 **操作日志**：后台写操作审计（谁/何时/做了什么），管理页可查
- 💾 **数据备份**：在线 SQLite 备份（WAL 安全），后台一键 + 服务器定时脚本
- 📂 **归档 / 标签 / 分类 / RSS** 齐全

**性能与体验**
- 首页滚动入场动效、统计数字 count-up、卡片多层 hover 反馈
- **响应式图片**：astro:assets（sharp）封面/相册/豆瓣图出多尺寸 webp + srcset，按视口选档
- **智能降级**：低端设备 / 触屏 / prefers-reduced-motion 时，WebGL 流体背景降级为静态渐变、关闭高开销动画——桌面端全特效，低端设备流畅
- **安全**：全站安全响应头（HSTS/X-Frame-Options/Referrer-Policy/Permissions-Policy）、登录失败锁定、admin 写操作审计、SQL 索引 + WAL
- SEO 完善：动态 sitemap.xml / robots.txt、canonical、RSS alternate、OG/Twitter 标签、文章 JSON-LD（BlogPosting + BreadcrumbList）
- 可访问性：skip-link、全局 focus-visible、表单 label、404 返回真状态码

---

## 🛠 技术栈

| 端 | 技术 |
|---|---|
| 前台 `site/` | Astro 5（SSR, node adapter）+ Vue 3 islands + GSAP |
| 后台 `admin/` | Vue 3 + Vite + vue-router + Tabler (Bootstrap 5) |
| 后端 `backend/` | Hono + Drizzle ORM + better-sqlite3 |
| 存储 | 本地磁盘 / 腾讯云 COS（后台切换） |
| 部署 | Docker Compose（nginx + site + api） |

---

## 🏗 架构

三端分离，代码都在本仓库根目录，开发时独立进程：

```
MBLOG/
├── backend/   # Hono API :3000（自动建库迁移 + FTS5）
├── site/      # Astro 前台 :4321（SSR，双主题）
└── admin/     # Vue 后台 :5173（base=/admin/）
```

- 后台管理页面：登录 → 仪表盘 / 文章 / 分类 / 标签 / 评论 / 说说 / **相册** / 友链 / 站点设置（含 SMTP 通知 / 备份）/ 主题配置 / **操作日志**
- 前台页面：首页 / 全部文章 / 归档 / 分类 / 标签 / 搜索 / 友链 / 项目 / 影音 / 说说 / **相册** / **关于** / 文章页（TOC + 相关文章 + 评论）

---

## 🚀 快速开始（本地开发）

前置：Node 24+、pnpm 11（可选）、better-sqlite3 v12（Node 24 prebuilt）。

```bash
# 终端 1：后端（首次自动建库、迁移、创建管理员 admin/admin123）
cd backend
npm install
npm run dev        # http://localhost:3000

# 终端 2：前台
cd site
npm install
npm run dev        # http://localhost:4321

# 终端 3：后台
cd admin
npm install
npm run dev        # http://localhost:5173/admin/login
```

**环境变量（backend）**
| 变量 | 说明 |
|---|---|
| `JWT_SECRET` | ≥32 字符，否则 fail-fast |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 生产必填（默认 admin/admin123） |

**环境变量（site）**
| 变量 | 说明 |
|---|---|
| `API_BASE` | 后端地址，默认 `http://localhost:3000` |

---

## 🧪 测试与检查

```bash
cd backend && npm test        # vitest 全量（102 项）
cd site && npm run check      # astro check 类型检查
cd admin && npm run typecheck # vue-tsc
cd admin && npm test          # vitest 最小单测
```

## 🤖 CI 与部署

- **GitHub Actions**（`.github/workflows/ci.yml`）：push/PR 自动跑三端 test / check / build
- **部署脚本**（`deploy.sh`）：`./deploy.sh backend|site|admin|all` 固化构建 → 打包 → scp → 备份覆盖 → PM2 重启（含 v22 PATH 正确姿势）→ 健康检查；服务器参数用环境变量覆盖（默认值即线上实测配置）

---

## 🐳 Docker 部署

```bash
cp .env.example .env   # 修改 JWT_SECRET 与管理员密码
docker compose up -d --build
```

- 前台 `http://<服务器>/`，后台 `http://<服务器>/admin/login`
- 数据卷：`mblog-data`（SQLite）、`mblog-uploads`（上传文件），备份即复制两卷
- `deploy/nginx` 反向代理 api / site

> 注意：OG 图（`/og/[slug].png`）依赖服务器 **CJK 字体**，生产环境需安装中文字体。

---

## ⚙️ 常用配置

- **主题**：后台「主题配置」可分别定制 normal / reader 的配色（5 色 + 主色色板）、字号、首页文章数、首屏头像/简介，以及**双主题各自的导航菜单**
- **站点**：后台「站点设置」管理站点信息、博主名称/头像、关于内容、存储（本地/COS）、Turnstile、**SMTP 邮件通知**、GitHub、豆瓣、**数据备份**、导航等
- **默认主题切换**：前台导航栏「阅读模式」按钮（localStorage 记忆）

---

## 📁 目录结构

```
backend/src/
  ├── db/          # schema（全部表）、migrate（幂等迁移）、连接
  ├── routes/
  │   ├── admin/   # auth/posts/categories/tags/comments/talks/photos/friendLinks/douban/settings/upload
  │   └── public/  # posts/categoriesTags/comments/talks/photos/friendLinks/github/douban/cover/stats/misc
  └── lib/         # settings/jwt/captcha/turnstile/themeConfig/slug
site/src/
  ├── pages/       # 首页（双渲染）/posts/archive/category/tag/search/friends/projects/douban/talk/gallery/about/post/sitemap/robots/og
  ├── components/  # Vue islands：PhotoGallery/CommentSection/LikeButton/ThemeToggle/PillNav/BorderGlow/HeroBackground/StatBubbles…
  └── styles/themes/ # normal.css / reader.css / tokens.css（双主题互不污染）
admin/src/
  ├── views/       # AdminLayout/Dashboard/PostList/PostEditor/Category/Tag/Comment/Talk/Photo/FriendLink/Settings/Themes
  ├── api/         # admin.ts（适配层）+ client.ts（fetch 封装）
  └── lib/         # theme.ts / toast.ts
```

---

## 🔍 设计约定

- **双主题隔离**：所有 CSS 带 `[data-theme='normal']` / `[data-theme='reader']` 前缀，互不污染；主题切换通过 `document.documentElement.dataset.theme` + `mblog-theme-change` 自定义事件
- **博客数据源**：前台首屏「你好，我是 X」与头像、关于页内容统一来自后台「站点设置 → 站点基础信息」
- **智能降级**：`lib/capabilities.ts` 检测设备能力，桌面端全特效、低端/无障碍降级（`data-lowend` 标记 + `prefers-reduced-motion`）
- **分页响应**：admin 接口统一 `{ list, total }`
- **密钥掩码**：敏感字段 GET 返回 `********`，PUT 收到占位符保留原值

---

## 📄 License

MIT
