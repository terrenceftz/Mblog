# MBLOG 博客系统设计文档

日期：2026-08-10
状态：已确认

## 1. 项目概述

轻巧的个人博客系统，前后端分离。单人写作 + 访客开放评论，部署在 VPS 上用 Docker 一键运行。

### 核心定位

- **轻巧**：依赖少、构建快、易维护
- **个人博客**：单管理员，无需复杂用户体系
- **开放评论**：访客可评论，后台审核
- **双主题换肤**：常规博客主题 + 极简阅读主题

### 功能范围（第一版）

1. Markdown 写作与渲染（代码高亮）
2. 标签 + 分类
3. 评论 + 审核（含回复）
4. 站内全文搜索（SQLite FTS5）
5. 管理后台（文章/分类/标签/评论/友链/设置）
6. Markdown 编辑器支持插入图片、音频
7. 归档、RSS、阅读量统计
8. 双主题（normal / reader）换肤
9. 友情链接：访客申请 + 后台审核

## 2. 技术栈

| 层 | 选型 |
|---|---|
| 前端·前台 | **Astro 5**（SSR，@astrojs/node + @astrojs/vue），Vue 组件做交互 island |
| 前端·后台 | **独立 Vue 3 SPA**（Vite + Vue Router，含 Vditor 编辑器），挂载于 /admin |
| UI | 自研轻量组件，双主题通过 CSS 变量 + 布局实现 |
| 后端 | Hono（Node 运行时）+ Drizzle ORM |
| 数据库 | SQLite（含 FTS5 全文搜索） |
| 认证 | JWT + 单管理员账号（bcrypt 密码） |
| Markdown 编辑 | Vditor（后台，所见即所得 + 分屏预览，自定义工具栏） |
| Markdown 渲染 | unified/remark + rehype-sanitize + rehype-highlight（后端渲染） |
| 文件存储 | 存储抽象层：LocalDiskStorage / TencentCOSStorage，后台可配置 |
| 平滑滚动 | Lenis（前台，正常主题启用、阅读模式关闭） |
| 部署 | Docker Compose：Nginx + Astro(site) + Vue(admin 静态) + API |

## 3. 系统架构

```
mblog/
├── site/                       # Astro 5 前台（SSR，@astrojs/node）
│   ├── astro.config.mjs        #   output: 'server' + node adapter + @astrojs/vue
│   ├── src/
│   │   ├── pages/              #   文件路由：首页/文章/分类/标签/搜索/归档/友链
│   │   ├── layouts/            #   基础布局（双主题 CSS 变量 + Lenis 脚本）
│   │   ├── components/         #   Vue islands：评论/主题切换/友链表单等
│   │   ├── lib/api.ts          #   服务端 API 请求封装
│   │   └── styles/             #   themes: tokens/normal/reader
├── admin/                      # Vue 3 SPA 后台（Vite，base=/admin/）
│   ├── src/
│   │   ├── views/              #   登录/仪表盘/文章/分类/标签/评论/友链/设置
│   │   ├── components/         #   后台通用组件
│   │   └── api/                #   管理 API 客户端
├── backend/                    # Hono + TypeScript + Drizzle
│   ├── src/
│   │   ├── routes/             # /api 下所有路由
│   │   ├── db/                 # Drizzle schema + 迁移
│   │   ├── storage/            # 存储抽象层
│   │   └── services/           # 业务逻辑
├── docker-compose.yml
└── README.md
```

**关键设计原则**：

- 前后端通过 REST API 通信：前台 Astro SSR 在服务端请求 Hono API 渲染 HTML；后台 SPA 在客户端请求
- 后端为无状态 API 服务，JWT 认证
- 存储通过 `StorageProvider` 接口抽象，新增存储源只需实现接口
- 主题与业务解耦：默认主题由后端 `settings` 配置，Astro 服务端注入 `<html data-theme>`；访客前端可切换，localStorage 记忆覆盖

## 4. 数据模型（SQLite + FTS5）

| 表 | 关键字段 | 说明 |
|---|---|---|
| `users` | id, username, password_hash | 管理员账号，初始化时创建 |
| `categories` | id, name, slug, sort_order | 分类 |
| `tags` | id, name, slug | 标签 |
| `posts` | id, title, slug, content_md, content_html, summary, cover, category_id, status(draft/published), view_count, created_at, updated_at | 文章 |
| `post_tags` | post_id, tag_id | 文章↔标签多对多 |
| `comments` | id, post_id, author, email, content, ip, status(pending/approved/rejected), parent_id, created_at | 评论，支持回复 |
| `friend_links` | id, name, url, description, avatar, status(pending/approved/rejected), created_at | 友链 |
| `media_files` | id, filename, url, size, mime, storage(local/cos), created_at | 媒体文件记录 |
| `settings` | key, value | 站点名、默认主题、存储配置(COS)、友链申请开关等 |

**全文搜索**：posts 表建 FTS5 虚拟表 `posts_fts`，索引 title + content_md，同步维护。

## 5. 存储抽象层

```ts
interface StorageProvider {
  upload(file: UploadFile, path: string): Promise<StorageResult>  // 返回 { url, key }
  delete(key: string): Promise<void>
  getUrl(key: string): string
}
```

- **LocalDiskStorage**：文件写 `backend/uploads/` 目录（Docker 卷挂载），Nginx 直接静态服务
- **TencentCOSStorage**：腾讯云 COS，SDK `@cos-nodejs-sdk-v5`，密钥从 settings 读取

后台设置页可切换当前存储源并填写 COS 配置（SecretId / SecretKey / Bucket / Region）。

## 6. API 设计（REST，JSON）

统一响应格式：`{ data }` 或 `{ error: { code, message } }`

### 公开 API（无需认证）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/posts` | 文章列表（分页，可筛选 category/tag，可搜索 q） |
| GET | `/api/posts/:slug` | 文章详情（含 content_html，阅读量 +1） |
| GET | `/api/categories` | 分类列表 |
| GET | `/api/tags` | 标签列表 |
| GET | `/api/comments?post_id=` | 已通过审核的评论（按文章） |
| POST | `/api/comments` | 发表评论（待审核） |
| GET | `/api/friend-links` | 已通过审核的友链 |
| POST | `/api/friend-links` | 申请友链（待审核） |
| GET | `/api/archive` | 按时间归档 |
| GET | `/api/rss` | RSS 订阅 |
| GET | `/api/settings/public` | 公开配置：站点名、默认主题、友链申请开关 |

### 管理 API（JWT 认证）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/admin/login` | 登录，返回 token |
| CRUD | `/api/admin/categories` | 分类管理 |
| CRUD | `/api/admin/tags` | 标签管理 |
| CRUD | `/api/admin/posts` | 文章管理（含草稿） |
| GET/PATCH/DELETE | `/api/admin/comments` | 评论审核/回复/删除/批量 |
| GET/PATCH/DELETE | `/api/admin/friend-links` | 友链审核/删除 |
| GET/PUT | `/api/admin/settings` | 设置读写（站点/主题/存储） |
| POST | `/api/admin/upload` | 媒体上传（multipart，图片/音频） |
| GET/DELETE | `/api/admin/media` | 媒体库 |
| GET | `/api/admin/stats` | 仪表盘统计 |

## 7. 前端设计

### 前台（Astro SSR + Vue islands）

- 页面服务端渲染：首页、文章详情、分类/标签/搜索/归档、友链页 —— SSR 从 Hono API 拉数据渲染 HTML，SEO 友好
- 交互部分用 Vue island（`client:load`）：评论组件、主题切换、友链申请表单
- 平滑滚动：Lenis 脚本，正常主题启用、阅读模式关闭

### 主题系统（换肤）

- `normal`：常规博客风格（卡片列表、多彩）；`reader`：极简阅读风格（大留白、纯文字、最小化干扰元素）
- 实现方式：两套 CSS 变量（颜色/字体/间距），通过 `<html data-theme>` 切换
- 默认主题由后端 `settings` 配置，Astro SSR 服务端注入 `data-theme`（无闪烁）；访客前端可切换，localStorage 记忆覆盖
- 阅读模式：文章页提供"阅读模式"按钮，一键切到 reader 主题

### 前台页面

- 首页：文章列表（摘要/阅读量），`?page=` 服务端分页
- 文章详情：后端渲染的 Markdown HTML + 代码高亮 + 阅读模式按钮 + 评论区（Vue island）
- 分类页 / 标签页：按分类/标签筛选文章
- 搜索页：关键词全文搜索（表单 GET → `?q=`）
- 友链页：通过审核的友链展示 + 申请表单（Vue island）
- 归档页：按时间归档
- RSS：后端 `/api/rss` 输出

### 评论组件（Vue island）

- 列表：按文章加载通过审核的评论，支持回复树（parent_id 分组 + 缩进）
- 发表表单：昵称 + 邮箱（可选）+ 内容，提交后提示"待审核"；支持回复
- 状态处理：加载中/空态/错误提示

### 后台（Vue 3 SPA，base=/admin/）

- 登录页
- 仪表盘：文章数、评论数、总阅读量、待审核评论数
- 文章管理：列表（状态/分类筛选）+ 新建/编辑
- Markdown 编辑器：Vditor，自定义工具栏按钮"插入图片/音频"→ 上传到后端 → 插入 markdown
- 分类管理 / 标签管理：CRUD 列表页
- 评论管理：审核（通过/拒绝/删除）、回复、批量操作
- 友链管理：审核申请、编辑、删除
- 设置页：站点信息、默认主题、存储配置（本地/COS 切换 + COS 表单）、友链申请开关

## 8. Markdown 管线

- **编辑**：Vditor（所见即所得模式 + 分屏实时预览），工具栏自定义"插入图片/音频"
  - 插入图片：上传图片 → 返回 URL → 插入 `![alt](url)`
  - 插入音频：上传音频 → 返回 URL → 插入 `<audio controls src="url">`（HTML 语法或自定义容器）
- **渲染**：`remark-parse` → 生成 HTML → `rehype-sanitize`（白名单防 XSS）→ `rehype-highlight`（代码高亮）
- 代码高亮主题跟随前端主题切换

## 9. 认证与安全

- 管理员密码 bcrypt 哈希，JWT 签发，Authorization header 传递
- 评论/友链申请做基础校验（长度、URL 格式）+ 简单 IP 限流
- Markdown 渲染统一 `rehype-sanitize`，防止存储型 XSS
- 上传文件校验 MIME 类型与大小限制（图片 ≤ 10MB，音频 ≤ 50MB）
- 开发环境 CORS 允许 Vite dev server（5173 → 3000）

## 10. 错误处理与测试

- 统一错误响应 `{ error: { code, message } }`，Hono 中间件捕获
- 后端测试：Vitest
  - 单元测试：服务层、存储抽象（用内存/mock）
  - 集成测试：API 冒烟（登录、CRUD 主流程）
- 前端测试：Vitest + Vue Test Utils（评论组件、主题切换等关键组件）

## 11. 部署（Docker Compose）

```
services:
  mblog-api:                     # Hono API
    build: ./backend
    volumes: [./data:/app/data, ./uploads:/app/uploads]
    env: JWT_SECRET 等
  mblog-site:                    # Astro SSR 前台
    build: ./site
    environment: API_BASE=http://mblog-api:3000
    depends_on: [mblog-api]
  mblog-web:                     # Nginx 入口
    build: ./deploy/nginx        # 或前端多阶段镜像
    ports: ["80:80"]
    # 路由：/admin/ → admin 静态文件；/api/ 与 /uploads/ → mblog-api；/ → mblog-site
```

- SQLite 文件在 `data` 卷，上传文件在 `uploads` 卷，备份=拷贝两个目录
- 后台 SPA 构建产物由 Nginx 静态服务（`/admin/`），history 路由回退到 `/admin/index.html`
- `.env` 管理 JWT_SECRET、COS 可选配置、站点域名
- 后台初始管理员账号通过初始化脚本/首次启动创建

## 12. 实现顺序（里程碑）

1. **M1 后端骨架**：项目初始化（Hono + Drizzle）、schema、迁移、FTS5 建表
2. **M2 公开 API**：文章/分类/标签/评论/友链/搜索/归档/RSS/公开设置
3. **M3 管理 API**：登录认证、分类/标签/文章/评论/友链 CRUD、上传与存储抽象、设置、统计
4. **M4 前台（Astro）骨架**：Astro SSR 项目、双主题 CSS 变量 + Lenis、BaseLayout、服务端 API 封装
5. **M5 前台页面**：首页、文章详情、分类/标签/搜索/归档、评论 island、友链页
6. **M6 后台（Vue SPA）**：登录、仪表盘、文章管理（Vditor 编辑器）、分类/标签/评论/友链管理、设置页
7. **M7 部署**：三服务 Dockerfile、Nginx 路由、docker-compose、初始化脚本、README

## 13. 非目标（YAGNI）

- 多用户/多角色体系（预留扩展但不实现）
- 邮件通知、短信、第三方登录
- 富文本编辑器（WYSIWYG 之外的 HTML 编辑）
- 国际化（i18n）
- 对象存储 CDN 加速配置（COS 自带，无需额外做）
