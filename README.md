# MBLOG 轻量博客系统

前后端分离的个人博客：Astro(前台) + Vue(后台) + Hono + SQLite，支持双主题换肤（含阅读模式）、Markdown 写作（图片/音频）、评论审核、友链申请审核、Lenis 平滑滚动。

## 技术栈

- 前台：Astro 5（SSR）+ Vue islands（评论/主题切换/友链表单）+ Lenis
- 后台：Vue 3 SPA（Vditor 编辑器）
- 后端：Hono + Drizzle ORM + better-sqlite3（FTS5 全文搜索，中文逐字分词）
- 存储：本地磁盘 / 腾讯云 COS（后台可切换）
- 部署：Docker Compose（Nginx + Astro + API 三服务）

## 目录

- `backend/` Hono API
- `site/` Astro 前台
- `admin/` Vue 后台

## 本地开发

```bash
# 终端 1：后端（首次自动建库并创建管理员 admin/admin123）
cd backend
npm install
npm run dev

# 终端 2：前台（4321）
cd site
npm install
npm run dev

# 终端 3：后台（5173，base=/admin/）
cd admin
npm install
npm run dev
```

- 前台 http://localhost:4321
- 后台 http://localhost:5173/admin/login

## 测试与检查

```bash
cd backend && npm test        # 后端测试
cd site && npm run check      # Astro 类型检查
cd admin && npm run typecheck # 后台类型检查
```

## Docker 部署

```bash
cp .env.example .env   # 修改 JWT_SECRET 与管理员密码
docker compose up -d --build
```

- 前台 http://<服务器>/ ，后台 http://<服务器>/admin/login
- 数据卷 `mblog-data`（SQLite）与 `mblog-uploads`（上传文件），备份即复制两卷。

## 常用操作

- 上传存储切换：后台「设置 → 存储」
- 默认主题切换：后台「设置 → 主题」
- 评论/友链审核：后台对应管理页
- 前台主题切换：导航栏"阅读模式"按钮（localStorage 记忆）
