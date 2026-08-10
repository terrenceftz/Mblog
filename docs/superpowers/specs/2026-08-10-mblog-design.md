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
| 前端 | Vite + Vue 3 + Vue Router（SPA，不用 Nuxt） |
| UI | 自研轻量组件，双主题通过 CSS 变量 + 布局组件实现 |
| 后端 | Hono（Node 运行时）+ Drizzle ORM |
| 数据库 | SQLite（含 FTS5 全文搜索） |
| 认证 | JWT + 单管理员账号（bcrypt 密码） |
| Markdown 编辑 | Vditor（所见即所得 + 分屏预览，自定义工具栏） |
| Markdown 渲染 | unified/remark + rehype-sanitize + rehype-highlight |
| 文件存储 | 存储抽象层：LocalDiskStorage / TencentCOSStorage，后台可配置 |
| 部署 | Docker Compose：Nginx(前端) + API(Node 20 alpine) |

## 3. 系统架构

```
mblog/
├── frontend/                  # Vite + Vue 3 SPA
│   ├── src/
│   │   ├── themes/            # 双主题：normal / reader
│   │   │   ├── normal/        #   常规博客风格
│   │   │   └── reader/        #   极简阅读风格
│   │   ├── views/             # 前台页面
│   │   ├── views/admin/       # 后台页面
│   │   ├── components/        # 通用组件（含评论组件）
│   │   └── api/               # API 客户端封装
├── backend/                   # Hono + TypeScript + Drizzle
│   ├── src/
│   │   ├── routes/            # /api 下所有路由
│   │   ├── db/                # Drizzle schema + 迁移
│   │   ├── storage/           # 存储抽象层
│   │   ├── services/          # 业务逻辑
│   │   └── middleware/        # JWT 认证等
├── docker-compose.yml
└── README.md
```

**关键设计原则**：

- 前后端通过 REST API 通信，前端 SPA 打包为静态文件
- 后端为无状态 API 服务，JWT 认证
- 存储通过 `StorageProvider` 接口抽象，新增存储源只需实现接口
- 主题与业务解耦：主题数据由后端 `settings` 配置默认值，前端本地覆盖

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

### 主题系统（换肤）

- `themes/normal/`：常规博客风格（卡片列表、侧栏、多彩）
- `themes/reader/`：极简阅读风格（大留白、纯文字、最小化干扰元素）
- 实现方式：两套 CSS 变量（颜色/字体/间距）+ 布局组件，通过 `theme` 属性切换
- 默认主题来自后端 `settings`，访客前端可切换，localStorage 记忆覆盖

### 前台页面

- 首页：文章列表（封面/摘要/标签），分页
- 文章详情：Markdown 渲染 + 代码高亮 + 阅读模式按钮 + 评论区
- 分类页 / 标签页：按分类/标签筛选文章
- 搜索页：关键词全文搜索
- 友链页：通过审核的友链展示 + 申请表单
- 归档页：按时间归档
- RSS：`/api/rss` 输出

### 评论组件

- 列表：按文章加载通过审核的评论，支持回复树
- 发表表单：昵称 + 邮箱（可选）+ 内容，提交后提示"待审核"
- 状态处理：加载中/空态/错误提示

### 后台页面

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
  mblog-api:
    build: ./backend
    volumes: [./data:/app/data, ./uploads:/app/uploads]
    env: JWT_SECRET 等
  mblog-web:
    build: ./frontend   # 多阶段：build 静态 → Nginx 托管 + 反代 /api → mblog-api
    ports: ["80:80"]
```

- SQLite 文件在 `./data` 卷，上传文件在 `./uploads` 卷，备份=拷贝两个目录
- `.env` 管理 JWT_SECRET、COS 可选配置
- 后台初始管理员账号通过初始化脚本/首次启动创建

## 12. 实现顺序（里程碑）

1. **M1 后端骨架**：项目初始化（Hono + Drizzle）、schema、迁移、FTS5 建表
2. **M2 公开 API**：文章/分类/标签/评论/友链/搜索/归档/RSS/公开设置
3. **M3 管理 API**：登录认证、分类/标签/文章/评论/友链 CRUD、上传与存储抽象、设置、统计
4. **M4 前端骨架**：Vite + Vue 3 + 路由 + 主题系统（CSS 变量双主题）
5. **M5 前台页面**：首页、文章详情（含渲染管线）、分类/标签/搜索/归档、评论组件、友链页
6. **M6 后台页面**：登录、仪表盘、文章管理（Vditor 编辑器）、分类/标签/评论/友链管理、设置页
7. **M7 部署**：Dockerfile、docker-compose.yml、Nginx 配置、初始化脚本、README

## 13. 非目标（YAGNI）

- 多用户/多角色体系（预留扩展但不实现）
- 邮件通知、短信、第三方登录
- 富文本编辑器（WYSIWYG 之外的 HTML 编辑）
- 国际化（i18n）
- 对象存储 CDN 加速配置（COS 自带，无需额外做）
