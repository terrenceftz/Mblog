# MBLOG 博客系统实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个轻巧的前后端分离个人博客系统（Vue 3 + Hono + SQLite），含双主题换肤、Markdown 编辑（图片/音频）、评论审核、友链申请审核、管理后台与 Docker 部署。

**Architecture:** monorepo 两个独立包（`frontend/` + `backend/`）。后端为 Hono REST API，SQLite 存储（含 FTS5 全文搜索），存储抽象层支持本地磁盘与腾讯云 COS 切换（后台可配置）。前端 Vite + Vue 3 SPA，双主题通过 CSS 变量 + 布局组件实现换肤，管理后台使用 Vditor 编辑器。Docker Compose 部署：Nginx(前端静态+反代) + API 容器。

**Tech Stack:** 后端 Hono / Drizzle ORM / better-sqlite3 / jose(JWT) / bcryptjs / unified·remark·rehype(Markdown) / cos-nodejs-sdk-v5 / Vitest；前端 Vue 3 / Vite / Vue Router / Vditor / highlight.js。

**依赖前提**：Node ≥ 20（本机 v20.16.0 ✅）、npm 10.8、git。生产数据库与上传目录为卷挂载目录。

---

## 文件结构总览

```
MBLOG/
├── backend/                       # Hono API 服务
│   ├── package.json / tsconfig.json / drizzle.config.ts / .env.example
│   ├── Dockerfile / .dockerignore
│   ├── drizzle/                   # drizzle-kit 生成的迁移（提交入库）
│   ├── src/
│   │   ├── index.ts               # 入口：建库、迁移、启动 HTTP
│   │   ├── app.ts                 # createApp(db)：组装路由、错误处理、静态
│   │   ├── db/
│   │   │   ├── index.ts           # createDb(path) 工厂（better-sqlite3 + drizzle）
│   │   │   ├── schema.ts          # 全部数据表定义
│   │   │   └── migrate.ts         # ensureMigrated：跑迁移+FTS建表+种子管理员
│   │   ├── lib/
│   │   │   ├── jwt.ts             # signToken / verifyToken（jose）
│   │   │   ├── settings.ts        # getSetting / setSetting / getSettings
│   │   │   └── slug.ts            # makeSlug（slugify + nanoid 兜底）
│   │   ├── middleware/
│   │   │   ├── auth.ts            # Bearer JWT 校验中间件
│   │   │   ├── error.ts           # 统一错误响应 onError
│   │   │   └── rateLimit.ts       # 简单 IP 限流
│   │   ├── services/
│   │   │   ├── markdown.ts        # renderMarkdown：remark/rehype 管线（防 XSS+高亮）
│   │   │   └── posts.ts           # createPost/updatePost/deletePost + FTS 同步 + 标签
│   │   ├── storage/
│   │   │   ├── index.ts           # StorageProvider 接口 + getStorage(db)
│   │   │   ├── local.ts           # LocalStorage
│   │   │   └── cos.ts             # COSStorage（腾讯云）
│   │   └── routes/
│   │       ├── public.ts          # 组装公开路由
│   │       ├── public/
│   │       │   ├── posts.ts       # GET /posts、GET /posts/:slug
│   │       │   ├── categoriesTags.ts
│   │       │   ├── comments.ts    # GET/POST /comments
│   │       │   ├── friendLinks.ts # GET/POST /friend-links
│   │       │   └── misc.ts        # /archive、/rss、/settings/public
│   │       ├── admin.ts           # 组装管理路由（挂 auth 中间件，除 /login）
│   │       └── admin/
│   │           ├── auth.ts        # POST /login
│   │           ├── categories.ts  # CRUD
│   │           ├── tags.ts        # CRUD
│   │           ├── posts.ts       # CRUD（含草稿）
│   │           ├── comments.ts    # 审核/删除/回复/批量
│   │           ├── friendLinks.ts # CRUD/审核
│   │           ├── settings.ts    # GET/PUT settings
│   │           └── upload.ts      # POST /upload、GET/DELETE /media、GET /stats
│   └── test/
│       ├── helpers.ts             # makeTestApp / loginAsAdmin
│       ├── markdown.test.ts
│       ├── posts.test.ts
│       ├── comments.test.ts
│       └── admin.test.ts
├── site/                          # Astro 5 前台（SSR + Vue islands）
│   ├── package.json / astro.config.mjs / tsconfig.json
│   ├── Dockerfile / .dockerignore
│   └── src/
│       ├── pages/
│       │   ├── index.astro        # 首页（?page= 服务端分页）
│       │   ├── post/[slug].astro  # 文章详情
│       │   ├── category/[slug].astro / tag/[slug].astro
│       │   ├── search.astro / archive.astro / friends.astro
│       │   └── 404.astro
│       ├── layouts/BaseLayout.astro   # html data-theme + 主题 CSS + Lenis
│       ├── components/            # Vue islands
│       │   ├── ThemeToggle.vue / CommentSection.vue / FriendLinkForm.vue
│       ├── lib/api.ts             # 服务端 API 请求封装（API_BASE）
│       ├── scripts/lenis.ts       # 平滑滚动（正常主题启用/阅读模式关闭）
│       └── styles/                # themes/tokens.css normal.css reader.css
├── admin/                         # Vue 3 SPA 后台（Vite，base=/admin/）
│   ├── package.json / vite.config.ts / tsconfig.json / index.html
│   ├── Dockerfile / .dockerignore
│   └── src/
│       ├── main.ts / App.vue
│       ├── router/index.ts        # base=/admin/，登录守卫
│       ├── api/client.ts / admin.ts / posts.ts
│       └── views/
│           ├── Login.vue
│           └── AdminLayout.vue / Dashboard.vue / PostList.vue / PostEditor.vue
│               / CategoryManager.vue / TagManager.vue / CommentManager.vue
│               / FriendLinkManager.vue / SettingsPage.vue
├── deploy/nginx/                  # Nginx 入口（静态 admin + 反向代理）
│   ├── Dockerfile / nginx.conf
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

# M1 后端骨架

### Task 1: 初始化后端项目

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/drizzle.config.ts`
- Create: `.gitignore`

- [ ] **Step 1: 创建 `backend/package.json`**

```json
{
  "name": "mblog-backend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "db:generate": "drizzle-kit generate",
    "test": "vitest run"
  },
  "dependencies": {
    "@hono/node-server": "^1.13.7",
    "bcryptjs": "^2.4.3",
    "better-sqlite3": "^11.7.0",
    "cos-nodejs-sdk-v5": "^2.13.4",
    "drizzle-orm": "^0.38.3",
    "hono": "^4.6.14",
    "jose": "^5.9.6",
    "nanoid": "^5.0.9",
    "rehype-highlight": "^7.0.1",
    "rehype-raw": "^7.0.0",
    "rehype-sanitize": "^6.0.0",
    "rehype-stringify": "^10.0.1",
    "remark-gfm": "^4.0.0",
    "remark-parse": "^11.0.0",
    "remark-rehype": "^11.1.1",
    "slugify": "^1.6.6",
    "unified": "^11.0.5"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/better-sqlite3": "^7.6.12",
    "@types/node": "^22.10.2",
    "drizzle-kit": "^0.30.1",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: 创建 `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "test", "drizzle.config.ts"]
}
```

- [ ] **Step 3: 创建 `backend/drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
```

- [ ] **Step 4: 创建根目录 `.gitignore`**

```gitignore
node_modules/
dist/
data/
uploads/
*.log
.env
```

- [ ] **Step 5: 安装依赖并验证**

Run: `cd backend && npm install`
Expected: 安装成功，`backend/node_modules` 出现，无报错。

- [ ] **Step 6: 提交**

```bash
git add backend/package.json backend/package-lock.json backend/tsconfig.json backend/drizzle.config.ts .gitignore
git commit -m "chore: 初始化后端项目（Hono + Drizzle + TS）"
```

### Task 2: 数据库 Schema

**Files:**
- Create: `backend/src/db/schema.ts`

- [ ] **Step 1: 创建 `backend/src/db/schema.ts`**

```ts
import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
});

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  contentMd: text('content_md').notNull().default(''),
  contentHtml: text('content_html').notNull().default(''),
  summary: text('summary').notNull().default(''),
  cover: text('cover').notNull().default(''),
  // 删除分类时文章自动置为"未分类"
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
  status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
  viewCount: integer('view_count').notNull().default(0),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
});

export const postTags = sqliteTable(
  'post_tags',
  {
    postId: integer('post_id').references(() => posts.id, { onDelete: 'cascade' }).notNull(),
    tagId: integer('tag_id').references(() => tags.id, { onDelete: 'cascade' }).notNull(),
  },
  // 复合主键：防重复关联 + 双列索引
  (t) => [primaryKey({ columns: [t.postId, t.tagId] })],
);

export const comments = sqliteTable('comments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  postId: integer('post_id').references(() => posts.id, { onDelete: 'cascade' }).notNull(),
  author: text('author').notNull(),
  email: text('email').notNull().default(''),
  content: text('content').notNull(),
  ip: text('ip').notNull().default(''),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
  parentId: integer('parent_id'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

export const friendLinks = sqliteTable('friend_links', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  url: text('url').notNull(),
  description: text('description').notNull().default(''),
  avatar: text('avatar').notNull().default(''),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

export const mediaFiles = sqliteTable('media_files', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  filename: text('filename').notNull(),
  url: text('url').notNull(),
  key: text('key').notNull(),
  size: integer('size').notNull(),
  mime: text('mime').notNull(),
  storage: text('storage').notNull().default('local'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull().default(''),
});
```

- [ ] **Step 2: 生成迁移**

Run: `cd backend && npx drizzle-kit generate`
Expected: 在 `backend/drizzle/` 生成 `0000_*.sql`，包含全部表 CREATE 语句。确认生成成功后提交该 SQL 文件。

- [ ] **Step 3: 提交**

```bash
git add backend/src/db/schema.ts backend/drizzle
git commit -m "feat: 定义全部数据库表 schema 并生成迁移"
```

### Task 3: 数据库连接、迁移与种子管理员

**Files:**
- Create: `backend/src/db/index.ts`
- Create: `backend/src/db/migrate.ts`

- [ ] **Step 1: 创建 `backend/src/db/index.ts`**

```ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export type Db = ReturnType<typeof createDb>;

export function createDb(path: string) {
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON'); // 显式启用外键级联
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}
```

- [ ] **Step 2: 创建 `backend/src/db/migrate.ts`**

```ts
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import bcrypt from 'bcryptjs';
import { users } from './schema';
import type { Db } from './index';

/** 运行迁移、建 FTS5 虚拟表、初始化管理员账号。 */
export function ensureMigrated(ctx: Db): void {
  migrate(ctx.db, { migrationsFolder: 'drizzle' });

  ctx.sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(title, content_md);
  `);

  const existing = ctx.db.select({ id: users.id }).from(users).limit(1).get();
  if (existing) return;

  const username = process.env.ADMIN_USERNAME ?? 'admin';
  const password = process.env.ADMIN_PASSWORD ?? 'admin123';
  const passwordHash = bcrypt.hashSync(password, 10);
  ctx.db.insert(users).values({ username, passwordHash }).run();
  console.log(`[init] 已创建管理员账号: ${username}`);
}
```

- [ ] **Step 3: 编写冒烟测试 `backend/test/helpers.ts`**

```ts
import { createApp } from '../src/app';
import { createDb } from '../src/db';
import { ensureMigrated } from '../src/db/migrate';

export function makeTestApp() {
  const ctx = createDb(':memory:');
  ensureMigrated(ctx);
  const app = createApp(ctx);
  return { app, ctx };
}
```

- [ ] **Step 4: 提交**

```bash
git add backend/src/db/index.ts backend/src/db/migrate.ts backend/test/helpers.ts
git commit -m "feat: 数据库连接工厂 + 迁移与管理员种子"
```

> 注：`backend/test/helpers.ts` 引用的 `createApp` 尚未实现，先不运行测试，Task 6 完成 app.ts 后再跑。

### Task 4: Markdown 渲染管线

**Files:**
- Create: `backend/src/services/markdown.ts`
- Test: `backend/test/markdown.test.ts`

- [ ] **Step 1: 创建 `backend/src/services/markdown.ts`**

```ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';

// 在默认白名单上扩展音频/视频标签，支持编辑器插入的 <audio>
const schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'audio', 'video', 'figure', 'figcaption'],
  attributes: {
    ...defaultSchema.attributes,
    audio: [...(defaultSchema.attributes?.audio ?? []), 'src', 'controls', 'preload', 'loop'],
    source: [...(defaultSchema.attributes?.source ?? []), 'src', 'type'],
    video: [...(defaultSchema.attributes?.video ?? []), 'src', 'controls', 'poster'],
  },
  protocols: {
    ...defaultSchema.protocols,
    poster: ['http', 'https'],
  },
};

export async function renderMarkdown(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, schema)
    .use(rehypeHighlight)
    .use(rehypeStringify)
    .process(md);
  return String(file);
}
```

- [ ] **Step 2: 编写测试 `backend/test/markdown.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../src/services/markdown';

describe('renderMarkdown', () => {
  it('渲染标题与代码高亮', async () => {
    const html = await renderMarkdown('# Hello\n\n```js\nconst a = 1;\n```');
    expect(html).toContain('<h1>Hello</h1>');
    expect(html).toContain('hljs');
  });

  it('允许音频标签', async () => {
    const html = await renderMarkdown('<audio controls src="/uploads/a.mp3"></audio>');
    expect(html).toContain('<audio controls');
    expect(html).toContain('/uploads/a.mp3');
  });

  it('剥离 script 脚本（防 XSS）', async () => {
    const html = await renderMarkdown('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
  });

  it('剥离事件属性（onerror）', async () => {
    const html = await renderMarkdown('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain('onerror');
  });

  it('剥离 javascript: 链接', async () => {
    const html = await renderMarkdown('[危险](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
  });

  it('支持 GFM 表格', async () => {
    const html = await renderMarkdown('| a | b |\n| - | - |\n| 1 | 2 |');
    expect(html).toContain('<table>');
  });
});
```

- [ ] **Step 3: 运行测试**

Run: `cd backend && npx vitest run test/markdown.test.ts`
Expected: 4 个用例全部 PASS。

- [ ] **Step 4: 提交**

```bash
git add backend/src/services/markdown.ts backend/test/markdown.test.ts
git commit -m "feat: Markdown 渲染管线（GFM+防XSS+代码高亮+音频白名单）"
```

### Task 5: 设置读取与 slug 工具

**Files:**
- Create: `backend/src/lib/settings.ts`
- Create: `backend/src/lib/slug.ts`

- [ ] **Step 1: 创建 `backend/src/lib/settings.ts`**

```ts
import { eq } from 'drizzle-orm';
import { settings } from '../db/schema';
import type { Db } from '../db';

export const DEFAULT_SETTINGS: Record<string, string> = {
  site_name: '我的博客',
  site_description: '',
  site_url: 'http://localhost',
  default_theme: 'normal',
  friend_link_enabled: '1',
  storage_provider: 'local',
  cos_secret_id: '',
  cos_secret_key: '',
  cos_bucket: '',
  cos_region: '',
};

export function getSetting(ctx: Db, key: string): string {
  const row = ctx.db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).get();
  return row?.value ?? DEFAULT_SETTINGS[key] ?? '';
}

export function getSettings(ctx: Db, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = getSetting(ctx, k);
  return out;
}

export function setSetting(ctx: Db, key: string, value: string): void {
  ctx.db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}
```

- [ ] **Step 2: 创建 `backend/src/lib/slug.ts`**

```ts
import slugify from 'slugify';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);

/** 由标题生成 slug；中文标题无 ASCII 结果时回退为 post-<random>。 */
export function makeSlug(title: string): string {
  const s = slugify(title, { lower: true, strict: true, trim: true });
  return s || `post-${nanoid()}`;
}
```

- [ ] **Step 3: 提交**

```bash
git add backend/src/lib/settings.ts backend/src/lib/slug.ts
git commit -m "feat: 设置读写工具与 slug 生成"
```

### Task 6: 应用骨架 + 统一错误处理 + 启动入口

**Files:**
- Create: `backend/src/middleware/error.ts`
- Create: `backend/src/app.ts`
- Create: `backend/src/index.ts`

- [ ] **Step 1: 创建 `backend/src/middleware/error.ts`**

```ts
import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

// 状态码 → 业务错误码映射，保持统一错误词汇表
const STATUS_CODES: Record<number, string> = {
  400: 'INVALID',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
};

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    const code = STATUS_CODES[err.status] ?? 'HTTP_ERROR';
    return c.json({ error: { code, message: err.message } }, err.status);
  }
  if (err instanceof SyntaxError) {
    // 客户端请求体 JSON 解析失败等输入错误
    return c.json({ error: { code: 'INVALID', message: '请求格式错误' } }, 400);
  }
  console.error('[error]', c.req.method, c.req.path, err);
  return c.json({ error: { code: 'INTERNAL', message: '服务器内部错误' } }, 500);
};
```

- [ ] **Step 2: 创建 `backend/src/app.ts`**

```ts
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { errorHandler } from './middleware/error';
import { publicRoutes } from './routes/public';
import { adminRoutes } from './routes/admin';
import type { Db } from './db';

export function createApp(ctx: Db) {
  const app = new Hono();
  app.onError(errorHandler);

  // 未匹配路由统一返回 JSON 错误
  app.notFound((c) =>
    c.json({ error: { code: 'NOT_FOUND', message: '接口不存在' } }, 404),
  );

  app.get('/api/health', (c) => c.json({ data: { status: 'ok' } }));

  // 开发环境：本地存储的文件由后端直接静态服务；生产由 Nginx 服务
  app.use('/uploads/*', serveStatic({ root: './' }));

  app.route('/api', publicRoutes(ctx));
  app.route('/api/admin', adminRoutes(ctx));
  return app;
}
```

- [ ] **Step 3: 创建 `backend/src/index.ts`**

```ts
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { createDb } from './db';
import { ensureMigrated } from './db/migrate';

const dbPath = process.env.DB_PATH ?? 'data/mblog.db';
// better-sqlite3 不会自动创建父目录
mkdirSync(path.dirname(dbPath), { recursive: true });
const ctx = createDb(dbPath);
ensureMigrated(ctx);

const app = createApp(ctx);
const port = Number(process.env.PORT ?? 3000);

console.log(`[server] http://localhost:${port}`);
serve({ fetch: app.fetch, port });
```

- [ ] **Step 4: 创建 `backend/src/routes/public.ts` 与 `backend/src/routes/admin.ts`（占位组装，路由文件后补）**

```ts
// backend/src/routes/public.ts
import { Hono } from 'hono';
import type { Db } from '../db';

export function publicRoutes(ctx: Db) {
  const app = new Hono();
  return app;
}
```

```ts
// backend/src/routes/admin.ts
import { Hono } from 'hono';
import type { Db } from '../db';

export function adminRoutes(ctx: Db) {
  const app = new Hono();
  return app;
}
```

- [ ] **Step 5: 运行测试（补上 helpers 引用的 createApp 后）**

Run: `cd backend && npx vitest run test/markdown.test.ts`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add backend/src/middleware/error.ts backend/src/app.ts backend/src/index.ts backend/src/routes/public.ts backend/src/routes/admin.ts
git commit -m "feat: 应用骨架、统一错误处理与启动入口"
```

### Task 7: JWT 工具 + 认证中间件 + 登录 API

**Files:**
- Create: `backend/src/lib/jwt.ts`
- Create: `backend/src/middleware/auth.ts`
- Create: `backend/src/routes/admin/auth.ts`
- Modify: `backend/src/routes/admin.ts`
- Test: `backend/test/admin.test.ts`

- [ ] **Step 1: 创建 `backend/src/lib/jwt.ts`**

```ts
import { SignJWT, jwtVerify } from 'jose';

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-change-me');

export async function signToken(payload: { username: string }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret());
}

export async function verifyToken(token: string): Promise<{ username: string }> {
  const { payload } = await jwtVerify(token, secret());
  return { username: String(payload.username) };
}
```

- [ ] **Step 2: 创建 `backend/src/middleware/auth.ts`**

```ts
import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { verifyToken } from '../lib/jwt';

export async function authMiddleware(c: Context, next: Next) {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: '未登录' });
  }
  try {
    const user = await verifyToken(header.slice(7));
    c.set('user', user);
    await next();
  } catch {
    throw new HTTPException(401, { message: '登录已过期或无效' });
  }
}
```

- [ ] **Step 3: 创建 `backend/src/routes/admin/auth.ts`**

```ts
import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { users } from '../../db/schema';
import { signToken } from '../../lib/jwt';
import type { Db } from '../../db';

// 预计算假哈希：用户不存在时也执行 bcrypt 比较，避免时序泄露用户是否存在
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

export function authRoutes(ctx: Db) {
  const app = new Hono();

  app.post('/login', async (c) => {
    const body = await c.req.json().catch(() => null);
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!username || !password) {
      return c.json({ error: { code: 'INVALID', message: '请输入用户名和密码' } }, 400);
    }
    const user = ctx.db.select().from(users).where(eq(users.username, username)).get();
    const ok = bcrypt.compareSync(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: '用户名或密码错误' } }, 401);
    }
    const token = await signToken({ username: user.username });
    return c.json({ data: { token } });
  });

  return app;
}
```

Step 4: 创建 `backend/src/context.d.ts`（Hono 上下文类型增强，后续路由 `c.get('user')` 有类型）：

```ts
import 'hono';

declare module 'hono' {
  interface ContextVariableMap {
    user: { username: string };
  }
}
```

- [ ] **Step 4: 更新 `backend/src/routes/admin.ts`**

```ts
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { authRoutes } from './admin/auth';
import type { Db } from '../db';

export function adminRoutes(ctx: Db) {
  const app = new Hono();
  app.route('/', authRoutes(ctx));
  app.use('*', authMiddleware);
  // 后续管理子路由在此挂载（需登录）
  return app;
}
```

- [ ] **Step 5: 编写测试 `backend/test/admin.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { makeTestApp } from './helpers';

describe('admin auth', () => {
  const { app } = makeTestApp();

  it('登录成功返回 token', async () => {
    const res = await app.request('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.token).toBeTruthy();
  });

  it('密码错误返回 401', async () => {
    const res = await app.request('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong' }),
    });
    expect(res.status).toBe(401);
  });

  it('未携带 token 访问受保护路由返回 401', async () => {
    const res = await app.request('/api/admin/posts');
    expect(res.status).toBe(401);
  });
});
```

> 注：测试第 3 条访问 `/api/admin/posts` 依赖后续路由；Task 9 前会 404（仍非 200），先把该断言改为 `/api/admin/login` 之外的任意受保护路径即可，Task 9 完成后再加回 posts。此处保留 posts 断言，Task 9 完成后该用例才会全绿。

- [ ] **Step 6: 运行测试**

Run: `cd backend && npx vitest run test/admin.test.ts`
Expected: 3 条全 PASS（第三条 `app.use('*', authMiddleware)` 对未匹配路径也生效，直接 401）。若第三条返回 404，检查 admin.ts 中间件注册顺序。

- [ ] **Step 7: 提交**

```bash
git add backend/src/lib/jwt.ts backend/src/middleware/auth.ts backend/src/routes/admin/auth.ts backend/src/routes/admin.ts backend/src/context.d.ts backend/test/admin.test.ts
git commit -m "feat: JWT 登录与认证中间件"
```

### Task 8: 限流中间件 + 后端测试基线

**Files:**
- Create: `backend/src/middleware/rateLimit.ts`
- Modify: `backend/test/helpers.ts`

- [ ] **Step 1: 创建 `backend/src/middleware/rateLimit.ts`**

```ts
import type { Context, Next } from 'hono';

const buckets = new Map<string, { count: number; resetAt: number }>();

/** 基于 IP 的简单限流（内存版，单实例够用）。 */
export function rateLimit(max: number, windowMs: number) {
  return async (c: Context, next: Next) => {
    // 优先取 x-real-ip（Nginx 设置为真实远端 IP）；XFF 取最右侧（由可信代理追加）
    const ip =
      c.req.header('x-real-ip')?.trim() ||
      c.req.header('x-forwarded-for')?.split(',').pop()?.trim() ||
      'unknown';
    const now = Date.now();
    const bucket = buckets.get(ip);
    if (!bucket) {
      buckets.set(ip, { count: 1, resetAt: now + windowMs });
    } else if (bucket.resetAt <= now) {
      buckets.delete(ip); // 惰性驱逐过期桶，防无限增长
      buckets.set(ip, { count: 1, resetAt: now + windowMs });
    } else if (bucket.count >= max) {
      return c.json({ error: { code: 'RATE_LIMITED', message: '操作过于频繁，请稍后再试' } }, 429);
    } else {
      bucket.count += 1;
    }
    await next();
  };
}

/** 仅测试用：清空限流桶，避免跨用例共享状态导致误 429。 */
export function resetRateLimit(): void {
  buckets.clear();
}
```

- [ ] **Step 2: 更新 `backend/test/helpers.ts` 增加登录辅助函数**

```ts
import { expect } from 'vitest';
import { createApp } from '../src/app';
import { createDb } from '../src/db';
import { ensureMigrated } from '../src/db/migrate';
import { resetRateLimit } from '../src/middleware/rateLimit';

export function makeTestApp() {
  resetRateLimit(); // 隔离限流桶状态
  const ctx = createDb(':memory:');
  ensureMigrated(ctx);
  const app = createApp(ctx);
  return { app, ctx };
}

export async function loginAsAdmin(app: ReturnType<typeof createApp>): Promise<string> {
  const res = await app.request('/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  expect(res.status).toBe(200); // 登录失败（如误触限流）立即暴露，避免下游难排查
  const body = (await res.json()) as { data: { token: string } };
  return body.data.token;
}

export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
```

- [ ] **Step 2b: 创建 `backend/vitest.config.ts` 与 `backend/test/setup.ts`（每个用例前重置限流桶）**

`backend/vitest.config.ts`：
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./test/setup.ts'],
  },
});
```

`backend/test/setup.ts`：
```ts
import { beforeEach } from 'vitest';
import { resetRateLimit } from '../src/middleware/rateLimit';

beforeEach(() => {
  resetRateLimit();
});
```

- [ ] **Step 3: 给登录接口加限流（防暴力破解）**

修改 `backend/src/routes/admin/auth.ts`：引入 `rateLimit` 并给 `/login` 加限流（每 IP 每 60 秒最多 5 次）：

```ts
import { rateLimit } from '../../middleware/rateLimit';
// ...
app.post('/login', rateLimit(5, 60_000), async (c) => {
```

- [ ] **Step 4: 追加无效 token 测试到 `backend/test/admin.test.ts`**

```ts
it('无效 token 访问受保护路由返回 401', async () => {
  const res = await app.request('/api/admin/posts', {
    headers: { Authorization: 'Bearer not-a-real-token' },
  });
  expect(res.status).toBe(401);
});
```

- [ ] **Step 5: 追加登录限流测试到 `backend/test/admin.test.ts`**

```ts
it('登录接口限流（连续 5 次失败后第 6 次 429）', async () => {
  for (let i = 0; i < 5; i++) {
    const res = await app.request('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong' }),
    });
    expect(res.status).toBe(401);
  }
  const res = await app.request('/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  expect(res.status).toBe(429);
  const body = await res.json();
  expect(body.error.code).toBe('RATE_LIMITED');
});
```

- [ ] **Step 6: 运行全部现有测试**

Run: `cd backend && npx vitest run`
Expected: 全部 PASS（markdown 6 + admin auth 5）。注意：每个用例前 `setup.ts` 会重置限流桶，因此限流测试不会污染其他用例。

- [ ] **Step 7: 提交**

```bash
git add backend/src/middleware/rateLimit.ts backend/test/helpers.ts backend/src/routes/admin/auth.ts backend/test/admin.test.ts backend/vitest.config.ts backend/test/setup.ts
git commit -m "feat: IP 限流中间件 + 登录限流 + 测试辅助函数"
```

---

# M2 公开 API

### Task 9: 公开文章列表与详情

**Files:**
- Create: `backend/src/routes/public/posts.ts`
- Modify: `backend/src/routes/public.ts`
- Test: `backend/test/posts.test.ts`

- [ ] **Step 1: 创建 `backend/src/routes/public/posts.ts`**

```ts
import { Hono } from 'hono';
import { eq, and, desc, count, inArray } from 'drizzle-orm';
import { posts, postTags, tags, categories } from '../../db/schema';
import type { Db } from '../../db';

export function postsRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/posts', async (c) => {
    // 分页参数加固：非法/小数一律回落默认值，防止 NaN 泄漏到 LIMIT/OFFSET
    const rawPage = Number(c.req.query('page') ?? 1);
    const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
    const rawSize = Number(c.req.query('pageSize') ?? 10);
    const pageSize = Number.isInteger(rawSize) && rawSize >= 1 ? Math.min(50, rawSize) : 10;
    const categorySlug = c.req.query('category')?.trim();
    const tagSlug = c.req.query('tag')?.trim();
    const q = c.req.query('q')?.trim();

    const conditions = [eq(posts.status, 'published')];

    if (categorySlug) {
      const cat = ctx.db.select({ id: categories.id }).from(categories).where(eq(categories.slug, categorySlug)).get();
      if (!cat) return c.json({ data: { list: [], total: 0 } });
      conditions.push(eq(posts.categoryId, cat.id));
    }

    if (tagSlug) {
      const tag = ctx.db.select({ id: tags.id }).from(tags).where(eq(tags.slug, tagSlug)).get();
      if (!tag) return c.json({ data: { list: [], total: 0 } });
      const postIds = ctx.db
        .select({ postId: postTags.postId })
        .from(postTags)
        .where(eq(postTags.tagId, tag.id))
        .all()
        .map((r) => r.postId);
      conditions.push(inArray(posts.id, postIds.length ? postIds : [0]));
    }

    if (q) {
      // FTS5 语法加固：按词分词并逐个加引号，特殊字符失去操作符语义；异常时兜底空结果
      const terms = q
        .split(/[^\w\u4e00-\u9fa5]+/)
        .filter(Boolean)
        .map((t) => `"${t.replace(/"/g, '')}"`);
      let rows: { id: number }[] = [];
      if (terms.length) {
        try {
          rows = ctx.sqlite
            .prepare('SELECT rowid AS id FROM posts_fts WHERE posts_fts MATCH ? ORDER BY rank LIMIT 200')
            .all(terms.join(' ')) as { id: number }[];
        } catch {
          rows = [];
        }
      }
      if (rows.length === 0) return c.json({ data: { list: [], total: 0 } });
      conditions.push(inArray(posts.id, rows.map((r) => r.id)));
    }

    const where = and(...conditions);
    const total = ctx.db.select({ n: count() }).from(posts).where(where).get()?.n ?? 0;
    const list = ctx.db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        summary: posts.summary,
        cover: posts.cover,
        viewCount: posts.viewCount,
        categoryId: posts.categoryId,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .where(where)
      .orderBy(desc(posts.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .all();

    return c.json({ data: { list, total } });
  });

  app.get('/posts/:slug', async (c) => {
    const slug = c.req.param('slug');
    const post = ctx.db
      .select({
        id: posts.id, title: posts.title, slug: posts.slug, summary: posts.summary,
        cover: posts.cover, categoryId: posts.categoryId, status: posts.status,
        viewCount: posts.viewCount, contentHtml: posts.contentHtml,
        createdAt: posts.createdAt, updatedAt: posts.updatedAt,
      })
      .from(posts)
      .where(and(eq(posts.slug, slug), eq(posts.status, 'published')))
      .get();
    if (!post) return c.json({ error: { code: 'NOT_FOUND', message: '文章不存在' } }, 404);

    // contentHtml 由写入时渲染存储（见 services/posts.ts）；此处返回存储值，仅递增阅读量
    const viewCount = post.viewCount + 1;
    ctx.db.update(posts).set({ viewCount }).where(eq(posts.id, post.id)).run();

    const postTagList = ctx.db
      .select({ name: tags.name, slug: tags.slug })
      .from(postTags)
      .innerJoin(tags, eq(postTags.tagId, tags.id))
      .where(eq(postTags.postId, post.id))
      .all();
    const category = post.categoryId
      ? ctx.db.select().from(categories).where(eq(categories.id, post.categoryId)).get()
      : null;

    return c.json({ data: { ...post, viewCount, tags: postTagList, category } });
  });

  return app;
}
```

- [ ] **Step 2: 更新 `backend/src/routes/public.ts`**

```ts
import { Hono } from 'hono';
import { postsRoutes } from './public/posts';
import type { Db } from '../db';

export function publicRoutes(ctx: Db) {
  const app = new Hono();
  app.route('/', postsRoutes(ctx));
  return app;
}
```

- [ ] **Step 3: 编写测试 `backend/test/posts.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { makeTestApp } from './helpers';
import { posts } from '../src/db/schema';

describe('public posts', () => {
  const { app, ctx } = makeTestApp();

  it('返回已发布文章列表', async () => {
    ctx.db.insert(posts).values([
      { title: '第一篇文章', slug: 'first', status: 'published', contentMd: 'hi' },
      { title: '草稿', slug: 'draft-1', status: 'draft', contentMd: 'hidden' },
    ]).run();
    const res = await app.request('/api/posts');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.total).toBe(1);
    expect(body.data.list[0].slug).toBe('first');
  });

  it('详情返回渲染 HTML 并递增阅读量', async () => {
    ctx.db.insert(posts).values({
      title: '详情', slug: 'detail', status: 'published', contentMd: '# 标题',
      contentHtml: '<h1>标题</h1>', // 写入时渲染的值（服务层负责生成）
    }).run();
    const res = await app.request('/api/posts/detail');
    const body = await res.json();
    expect(body.data.contentHtml).toContain('<h1>标题</h1>');
    expect(body.data.viewCount).toBe(1);
    const again = await app.request('/api/posts/detail');
    const body2 = await again.json();
    expect(body2.data.viewCount).toBe(2);
  });

  it('不存在的文章返回 404', async () => {
    const res = await app.request('/api/posts/nope');
    expect(res.status).toBe(404);
  });

  it('支持关键词搜索', async () => {
    const row = ctx.db.insert(posts).values({
      title: 'TypeScript 教程', slug: 'ts', status: 'published', contentMd: 'Hono 很轻',
    }).returning({ id: posts.id }).get();
    ctx.sqlite.prepare('INSERT INTO posts_fts(rowid, title, content_md) VALUES (?, ?, ?)')
      .run(row.id, 'TypeScript 教程', 'Hono 很轻');
    const res = await app.request('/api/posts?q=Hono');
    const body = await res.json();
    expect(body.data.total).toBe(1);
    expect(body.data.list[0].slug).toBe('ts');
  });

  it('草稿详情返回 404', async () => {
    ctx.db.insert(posts).values({ title: '草稿', slug: 'draft-2', status: 'draft', contentMd: '', contentHtml: '' }).run();
    const res = await app.request('/api/posts/draft-2');
    expect(res.status).toBe(404);
  });

  it('非法分页参数不返回 500 也不泄露全表', async () => {
    const res = await app.request('/api/posts?page=abc&pageSize=1.5');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.list.length).toBeLessThanOrEqual(10);
  });

  it('FTS 特殊字符不返回 500', async () => {
    for (const q of ['*', '(', 'node-js', 'Hono OR Alpha']) {
      const res = await app.request(`/api/posts?q=${encodeURIComponent(q)}`);
      expect(res.status).toBe(200);
      expect(res.ok).toBe(true);
    }
  });
});
```

- [ ] **Step 4: 运行测试**

Run: `cd backend && npx vitest run test/posts.test.ts test/admin.test.ts`
Expected: posts 4 条 PASS；admin.test.ts 第三条（无 token 访问 posts）现在返回 200 → 预期为 401，实际返回 200 说明 auth 未拦截，需检查。修正 admin.ts 挂载顺序后再跑。

> 排查提示：`app.use('*', authMiddleware)` 必须在使用 `app.route('/', authRoutes(ctx))` 之后、并在挂载其他子路由之前。确认后重跑，第三条应 PASS（401）。

- [ ] **Step 5: 提交**

```bash
git add backend/src/routes/public/posts.ts backend/src/routes/public.ts backend/test/posts.test.ts
git commit -m "feat: 公开文章列表/详情/搜索 API"
```

### Task 10: 公开分类与标签

**Files:**
- Create: `backend/src/routes/public/categoriesTags.ts`
- Modify: `backend/src/routes/public.ts`
- Test: `backend/test/posts.test.ts`（追加用例）

- [ ] **Step 1: 创建 `backend/src/routes/public/categoriesTags.ts`**

```ts
import { Hono } from 'hono';
import { eq, desc, count, and } from 'drizzle-orm';
import { categories, tags, posts, postTags } from '../../db/schema';
import type { Db } from '../../db';

export function categoriesTagsRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/categories', (c) => {
    // postCount 只统计已发布文章
    const rows = ctx.db.select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      postCount: count(posts.id),
    }).from(categories)
      .leftJoin(posts, and(eq(posts.categoryId, categories.id), eq(posts.status, 'published')))
      .groupBy(categories.id)
      .orderBy(desc(categories.sortOrder))
      .all();
    return c.json({ data: rows });
  });

  app.get('/tags', (c) => {
    // postCount 只统计关联了已发布文章
    const rows = ctx.db.select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      postCount: count(posts.id),
    }).from(tags)
      .leftJoin(postTags, eq(postTags.tagId, tags.id))
      .leftJoin(posts, and(eq(posts.id, postTags.postId), eq(posts.status, 'published')))
      .groupBy(tags.id)
      .all();
    return c.json({ data: rows });
  });

  return app;
}
```

- [ ] **Step 2: 更新 `backend/src/routes/public.ts`**

```ts
import { Hono } from 'hono';
import { postsRoutes } from './public/posts';
import { categoriesTagsRoutes } from './public/categoriesTags';
import type { Db } from '../db';

export function publicRoutes(ctx: Db) {
  const app = new Hono();
  app.route('/', postsRoutes(ctx));
  app.route('/', categoriesTagsRoutes(ctx));
  return app;
}
```

- [ ] **Step 3: 追加测试到 `backend/test/posts.test.ts`**

```ts
  it('返回分类列表（含已发布文章数）', async () => {
    const cat = ctx.db.insert(categories).values({ name: '前端', slug: 'frontend' }).returning({ id: categories.id }).get();
    ctx.db.insert(posts).values([
      { title: 'a', slug: 'a', status: 'published', contentMd: '', categoryId: cat.id },
      { title: '草稿', slug: 'a-draft', status: 'draft', contentMd: '', categoryId: cat.id },
    ]).run();
    const res = await app.request('/api/categories');
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].name).toBe('前端');
    expect(body.data[0].postCount).toBe(1); // 草稿不计入
  });

  it('返回标签列表（只统计已发布文章）', async () => {
    ctx.db.insert(tags).values({ name: 'Vue', slug: 'vue' }).run();
    const pub = ctx.db.insert(posts).values({ title: 'p', slug: 'p', status: 'published', contentMd: '' }).returning({ id: posts.id }).get();
    const draft = ctx.db.insert(posts).values({ title: 'd', slug: 'd', status: 'draft', contentMd: '' }).returning({ id: posts.id }).get();
    ctx.db.insert(postTags).values([{ postId: pub.id, tagId: 1 }, { postId: draft.id, tagId: 1 }]).run();
    const res = await app.request('/api/tags');
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].postCount).toBe(1); // 草稿不计入
  });
```

- [ ] **Step 4: 运行测试**

Run: `cd backend && npx vitest run test/posts.test.ts`
Expected: 全 PASS。

- [ ] **Step 5: 提交**

```bash
git add backend/src/routes/public/categoriesTags.ts backend/src/routes/public.ts backend/test/posts.test.ts
git commit -m "feat: 公开分类/标签列表 API"
```

### Task 11: 公开评论（列表 + 发表）

**Files:**
- Create: `backend/src/routes/public/comments.ts`
- Modify: `backend/src/routes/public.ts`
- Test: `backend/test/comments.test.ts`

- [ ] **Step 1: 创建 `backend/src/routes/public/comments.ts`**

```ts
import { Hono } from 'hono';
import { eq, and, asc } from 'drizzle-orm';
import { comments, posts } from '../../db/schema';
import { rateLimit } from '../../middleware/rateLimit';
import type { Db } from '../../db';

export function commentsRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/comments', (c) => {
    const postId = Number(c.req.query('post_id'));
    if (!postId || !Number.isInteger(postId)) {
      return c.json({ error: { code: 'INVALID', message: '缺少有效的 post_id' } }, 400);
    }
    // 只暴露公开字段，不返回 email/ip
    const rows = ctx.db
      .select({
        id: comments.id,
        postId: comments.postId,
        author: comments.author,
        content: comments.content,
        parentId: comments.parentId,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .where(and(eq(comments.postId, postId), eq(comments.status, 'approved')))
      .orderBy(asc(comments.createdAt))
      .all();
    return c.json({ data: rows });
  });

  app.post('/comments', rateLimit(10, 60_000), async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.postId !== 'number' || typeof body.author !== 'string' || typeof body.content !== 'string') {
      return c.json({ error: { code: 'INVALID', message: '参数错误' } }, 400);
    }
    const author = body.author.trim().slice(0, 50);
    const content = body.content.trim().slice(0, 2000);
    const email = typeof body.email === 'string' ? body.email.trim().slice(0, 100) : '';
    if (!author || !content) return c.json({ error: { code: 'INVALID', message: '昵称和内容不能为空' } }, 400);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return c.json({ error: { code: 'INVALID', message: '邮箱格式不正确' } }, 400);
    }

    const post = ctx.db
      .select()
      .from(posts)
      .where(and(eq(posts.id, body.postId), eq(posts.status, 'published')))
      .get();
    if (!post) return c.json({ error: { code: 'NOT_FOUND', message: '文章不存在' } }, 404);

    const parentId = typeof body.parentId === 'number' ? body.parentId : null;
    if (parentId !== null) {
      const parent = ctx.db
        .select({ id: comments.id, postId: comments.postId, status: comments.status })
        .from(comments)
        .where(eq(comments.id, parentId))
        .get();
      if (!parent || parent.postId !== post.id || parent.status !== 'approved') {
        return c.json({ error: { code: 'INVALID', message: '回复的评论不存在或不可回复' } }, 400);
      }
    }

    const ip =
      c.req.header('x-real-ip')?.trim() ||
      c.req.header('x-forwarded-for')?.split(',').pop()?.trim() ||
      'unknown';

    ctx.db.insert(comments).values({ postId: post.id, author, email, content, ip, status: 'pending', parentId }).run();
    return c.json({ data: { message: '评论已提交，等待审核' } }, 201);
  });

  return app;
}
```

- [ ] **Step 2: 更新 `backend/src/routes/public.ts`**

```ts
import { Hono } from 'hono';
import { postsRoutes } from './public/posts';
import { categoriesTagsRoutes } from './public/categoriesTags';
import { commentsRoutes } from './public/comments';
import type { Db } from '../db';

export function publicRoutes(ctx: Db) {
  const app = new Hono();
  app.route('/', postsRoutes(ctx));
  app.route('/', categoriesTagsRoutes(ctx));
  app.route('/', commentsRoutes(ctx));
  return app;
}
```

- [ ] **Step 3: 编写测试 `backend/test/comments.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { makeTestApp } from './helpers';
import { posts, comments } from '../src/db/schema';

describe('public comments', () => {
  const { app, ctx } = makeTestApp();

  it('发表评论进入待审核', async () => {
    ctx.db.insert(posts).values({ title: 't', slug: 't', status: 'published', contentMd: '' }).run();
    const res = await app.request('/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ postId: 1, author: '小明', content: '写得好' }),
    });
    expect(res.status).toBe(201);
    const rows = ctx.db.select().from(comments).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('pending');
  });

  it('评论列表只返回已审核评论', async () => {
    ctx.db.insert(comments).values([
      { postId: 1, author: 'a', content: 'approved', status: 'approved' },
      { postId: 1, author: 'b', content: 'pending', status: 'pending' },
    ]).run();
    const res = await app.request('/api/comments?post_id=1');
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].content).toBe('approved');
  });

  it('不存在的文章不可评论', async () => {
    const res = await app.request('/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ postId: 999, author: 'a', content: 'x' }),
    });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 4: 运行测试**

Run: `cd backend && npx vitest run test/comments.test.ts`
Expected: 3 条 PASS。

- [ ] **Step 5: 提交**

```bash
git add backend/src/routes/public/comments.ts backend/src/routes/public.ts backend/test/comments.test.ts
git commit -m "feat: 公开评论列表与发表（审核+限流）"
```

### Task 12: 公开友链（列表 + 申请）

**Files:**
- Create: `backend/src/routes/public/friendLinks.ts`
- Modify: `backend/src/routes/public.ts`
- Test: `backend/test/comments.test.ts`（追加用例）

- [ ] **Step 1: 创建 `backend/src/routes/public/friendLinks.ts`**

```ts
import { Hono } from 'hono';
import { eq, asc } from 'drizzle-orm';
import { friendLinks } from '../../db/schema';
import { rateLimit } from '../../middleware/rateLimit';
import { getSetting } from '../../lib/settings';
import type { Db } from '../../db';

export function friendLinksRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/friend-links', (c) => {
    // 只暴露已审核友链；不返回 status 等内部字段
    const rows = ctx.db
      .select({
        id: friendLinks.id,
        name: friendLinks.name,
        url: friendLinks.url,
        description: friendLinks.description,
        avatar: friendLinks.avatar,
      })
      .from(friendLinks)
      .where(eq(friendLinks.status, 'approved'))
      .orderBy(asc(friendLinks.createdAt))
      .all();
    return c.json({ data: rows });
  });

  app.post('/friend-links', rateLimit(5, 60_000), async (c) => {
    if (getSetting(ctx, 'friend_link_enabled') !== '1') {
      return c.json({ error: { code: 'DISABLED', message: '友链申请已关闭' } }, 403);
    }
    const body = await c.req.json().catch(() => null);
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 50) : '';
    const url = typeof body?.url === 'string' ? body.url.trim().slice(0, 300) : '';
    const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 200) : '';
    if (!name || !url || !/^https?:\/\//i.test(url)) {
      return c.json({ error: { code: 'INVALID', message: '请填写站名和有效网址' } }, 400);
    }
    ctx.db.insert(friendLinks).values({ name, url, description, status: 'pending' }).run();
    return c.json({ data: { message: '申请已提交，等待审核' } }, 201);
  });

  return app;
}
```

- [ ] **Step 2: 更新 `backend/src/routes/public.ts`**

```ts
import { Hono } from 'hono';
import { postsRoutes } from './public/posts';
import { categoriesTagsRoutes } from './public/categoriesTags';
import { commentsRoutes } from './public/comments';
import { friendLinksRoutes } from './public/friendLinks';
import type { Db } from '../db';

export function publicRoutes(ctx: Db) {
  const app = new Hono();
  app.route('/', postsRoutes(ctx));
  app.route('/', categoriesTagsRoutes(ctx));
  app.route('/', commentsRoutes(ctx));
  app.route('/', friendLinksRoutes(ctx));
  return app;
}
```

- [ ] **Step 3: 追加测试到 `backend/test/comments.test.ts`**

```ts
it('友链列表只返回已审核', async () => {
  const res = await app.request('/api/friend-links', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '示例站', url: 'https://example.com', description: '你好' }),
  });
  expect(res.status).toBe(201);
  const listRes = await app.request('/api/friend-links');
  const list = await listRes.json();
  expect(list.data).toHaveLength(0); // 待审核，不展示
});
```

- [ ] **Step 4: 运行测试**

Run: `cd backend && npx vitest run test/comments.test.ts`
Expected: 4 条 PASS。

- [ ] **Step 5: 提交**

```bash
git add backend/src/routes/public/friendLinks.ts backend/src/routes/public.ts backend/test/comments.test.ts
git commit -m "feat: 公开友链列表与申请"
```

### Task 13: 归档 / RSS / 公开设置

**Files:**
- Create: `backend/src/routes/public/misc.ts`
- Modify: `backend/src/routes/public.ts`
- Test: `backend/test/posts.test.ts`（追加用例）

- [ ] **Step 1: 创建 `backend/src/routes/public/misc.ts`**

```ts
import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { posts } from '../../db/schema';
import { getSettings } from '../../lib/settings';
import type { Db } from '../../db';

export function miscRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/archive', (c) => {
    const rows = ctx.db
      .select({ createdAt: posts.createdAt, title: posts.title, slug: posts.slug })
      .from(posts)
      .where(eq(posts.status, 'published'))
      .orderBy(desc(posts.createdAt))
      .all();

    const groups = new Map<string, typeof rows>();
    for (const r of rows) {
      const d = new Date(r.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    const data = [...groups.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([month, items]) => ({ month, items }));
    return c.json({ data });
  });

  app.get('/rss', (c) => {
    const { site_name: siteName, site_description: siteDesc, site_url: siteUrl } = getSettings(ctx, [
      'site_name',
      'site_description',
      'site_url',
    ]);
    const baseUrl = siteUrl || 'http://localhost';
    const list = ctx.db
      .select({ title: posts.title, slug: posts.slug, summary: posts.summary, createdAt: posts.createdAt })
      .from(posts)
      .where(eq(posts.status, 'published'))
      .orderBy(desc(posts.createdAt))
      .limit(20)
      .all();

    const items = list
      .map((p) => {
        const link = `${baseUrl}/post/${p.slug}`;
        return `<item>
  <title><![CDATA[${p.title}]]></title>
  <link>${link}</link>
  <guid>${link}</guid>
  <description><![CDATA[${p.summary}]]></description>
  <pubDate>${new Date(p.createdAt).toUTCString()}</pubDate>
</item>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title><![CDATA[${siteName}]]></title>
  <description><![CDATA[${siteDesc}]]></description>
  <link>${baseUrl}</link>
${items}
</channel>
</rss>`;
    c.header('Content-Type', 'application/rss+xml; charset=utf-8');
    return c.body(xml);
  });

  app.get('/settings/public', (c) => {
    const { site_name: siteName, site_description: siteDesc, default_theme: theme, friend_link_enabled: friendLinkEnabled } =
      getSettings(ctx, ['site_name', 'site_description', 'default_theme', 'friend_link_enabled']);
    return c.json({ data: { siteName, siteDesc, theme, friendLinkEnabled: friendLinkEnabled === '1' } });
  });

  return app;
}
```

- [ ] **Step 2: 更新 `backend/src/routes/public.ts`**

```ts
import { Hono } from 'hono';
import { postsRoutes } from './public/posts';
import { categoriesTagsRoutes } from './public/categoriesTags';
import { commentsRoutes } from './public/comments';
import { friendLinksRoutes } from './public/friendLinks';
import { miscRoutes } from './public/misc';
import type { Db } from '../db';

export function publicRoutes(ctx: Db) {
  const app = new Hono();
  app.route('/', postsRoutes(ctx));
  app.route('/', categoriesTagsRoutes(ctx));
  app.route('/', commentsRoutes(ctx));
  app.route('/', friendLinksRoutes(ctx));
  app.route('/', miscRoutes(ctx));
  return app;
}
```

- [ ] **Step 3: 追加测试到 `backend/test/posts.test.ts`**

```ts
it('RSS 输出 xml', async () => {
  const res = await app.request('/api/rss');
  expect(res.headers.get('content-type')).toContain('application/rss+xml');
  const text = await res.text();
  expect(text).toContain('<rss');
});

it('公开设置返回主题与站点名', async () => {
  const res = await app.request('/api/settings/public');
  const body = await res.json();
  expect(body.data.siteName).toBeTruthy();
  expect(body.data.theme).toBe('normal');
});
```

- [ ] **Step 4: 运行测试**

Run: `cd backend && npx vitest run`
Expected: 全部 PASS（含此前用例）。

- [ ] **Step 5: 提交**

```bash
git add backend/src/routes/public/misc.ts backend/src/routes/public.ts backend/test/posts.test.ts
git commit -m "feat: 归档、RSS 与公开设置 API"
```

---

# M3 管理 API

### Task 14: 管理端分类 CRUD

**Files:**
- Create: `backend/src/routes/admin/categories.ts`
- Modify: `backend/src/routes/admin.ts`
- Test: `backend/test/admin.test.ts`（追加用例）

- [ ] **Step 1: 创建 `backend/src/routes/admin/categories.ts`**

```ts
import { Hono } from 'hono';
import { eq, desc, count } from 'drizzle-orm';
import { categories, posts } from '../../db/schema';
import { makeSlug } from '../../lib/slug';
import type { Db } from '../../db';

export function categoriesAdminRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/categories', (c) => {
    const rows = ctx.db.select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      sortOrder: categories.sortOrder,
      postCount: count(posts.id),
    }).from(categories)
      .leftJoin(posts, eq(posts.categoryId, categories.id))
      .groupBy(categories.id)
      .orderBy(desc(categories.sortOrder))
      .all();
    return c.json({ data: rows });
  });

  app.post('/categories', async (c) => {
    const body = await c.req.json().catch(() => null);
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 50) : '';
    if (!name) return c.json({ error: { code: 'INVALID', message: '分类名不能为空' } }, 400);
    const slug = typeof body?.slug === 'string' && body.slug.trim() ? body.slug.trim() : makeSlug(name);
    const sortOrder = typeof body?.sortOrder === 'number' ? body.sortOrder : 0;
    const existing = ctx.db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)).get();
    if (existing) return c.json({ error: { code: 'CONFLICT', message: 'slug 已存在' } }, 409);
    const row = ctx.db.insert(categories).values({ name, slug, sortOrder }).returning().get();
    return c.json({ data: row }, 201);
  });

  app.put('/categories/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => null);
    const row = ctx.db.select().from(categories).where(eq(categories.id, id)).get();
    if (!row) return c.json({ error: { code: 'NOT_FOUND', message: '分类不存在' } }, 404);
    const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : row.name;
    const slug = typeof body?.slug === 'string' && body.slug.trim() ? body.slug.trim() : row.slug;
    const sortOrder = typeof body?.sortOrder === 'number' ? body.sortOrder : row.sortOrder;
    ctx.db.update(categories).set({ name, slug, sortOrder }).where(eq(categories.id, id)).run();
    return c.json({ data: { id } });
  });

  app.delete('/categories/:id', (c) => {
    const id = Number(c.req.param('id'));
    ctx.db.delete(categories).where(eq(categories.id, id)).run();
    return c.json({ data: { ok: true } });
  });

  return app;
}
```

- [ ] **Step 2: 更新 `backend/src/routes/admin.ts`**

```ts
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { authRoutes } from './admin/auth';
import { categoriesAdminRoutes } from './admin/categories';
import type { Db } from '../db';

export function adminRoutes(ctx: Db) {
  const app = new Hono();
  app.route('/', authRoutes(ctx));
  app.use('*', authMiddleware);
  app.route('/', categoriesAdminRoutes(ctx));
  return app;
}
```

- [ ] **Step 3: 追加测试到 `backend/test/admin.test.ts`**

```ts
describe('admin categories', () => {
  const { app } = makeTestApp();
  let token = '';

  beforeAll(async () => {
    const res = await app.request('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    token = (await res.json()).data.token;
  });

  it('创建、列出、更新、删除分类', async () => {
    const headers = { Authorization: `Bearer ${token}` };
    const create = await app.request('/api/admin/categories', {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ name: '前端' }),
    });
    expect(create.status).toBe(201);

    const list = await app.request('/api/admin/categories', { headers });
    const body = await list.json();
    expect(body.data[0].name).toBe('前端');

    const update = await app.request('/api/admin/categories/1', {
      method: 'PUT', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ name: '前端开发' }),
    });
    expect(update.status).toBe(200);

    const del = await app.request('/api/admin/categories/1', { method: 'DELETE', headers });
    expect(del.status).toBe(200);
  });
});
```

- [ ] **Step 4: 运行测试**

Run: `cd backend && npx vitest run test/admin.test.ts`
Expected: 全 PASS（此前 3 条 + 新增 1 条）。

- [ ] **Step 5: 提交**

```bash
git add backend/src/routes/admin/categories.ts backend/src/routes/admin.ts backend/test/admin.test.ts
git commit -m "feat: 管理端分类 CRUD"
```

### Task 15: 管理端标签 CRUD

**Files:**
- Create: `backend/src/routes/admin/tags.ts`
- Modify: `backend/src/routes/admin.ts`
- Test: `backend/test/admin.test.ts`（追加用例）

- [ ] **Step 1: 创建 `backend/src/routes/admin/tags.ts`**

```ts
import { Hono } from 'hono';
import { eq, count } from 'drizzle-orm';
import { tags, postTags } from '../../db/schema';
import { makeSlug } from '../../lib/slug';
import type { Db } from '../../db';

export function tagsAdminRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/tags', (c) => {
    const rows = ctx.db.select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      postCount: count(postTags.postId),
    }).from(tags)
      .leftJoin(postTags, eq(postTags.tagId, tags.id))
      .groupBy(tags.id)
      .all();
    return c.json({ data: rows });
  });

  app.post('/tags', async (c) => {
    const body = await c.req.json().catch(() => null);
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 50) : '';
    if (!name) return c.json({ error: { code: 'INVALID', message: '标签名不能为空' } }, 400);
    const slug = typeof body?.slug === 'string' && body.slug.trim() ? body.slug.trim() : makeSlug(name);
    const existing = ctx.db.select({ id: tags.id }).from(tags).where(eq(tags.slug, slug)).get();
    if (existing) return c.json({ error: { code: 'CONFLICT', message: 'slug 已存在' } }, 409);
    const row = ctx.db.insert(tags).values({ name, slug }).returning().get();
    return c.json({ data: row }, 201);
  });

  app.put('/tags/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => null);
    const row = ctx.db.select().from(tags).where(eq(tags.id, id)).get();
    if (!row) return c.json({ error: { code: 'NOT_FOUND', message: '标签不存在' } }, 404);
    const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : row.name;
    const slug = typeof body?.slug === 'string' && body.slug.trim() ? body.slug.trim() : row.slug;
    ctx.db.update(tags).set({ name, slug }).where(eq(tags.id, id)).run();
    return c.json({ data: { id } });
  });

  app.delete('/tags/:id', (c) => {
    const id = Number(c.req.param('id'));
    ctx.db.delete(tags).where(eq(tags.id, id)).run();
    return c.json({ data: { ok: true } });
  });

  return app;
}
```

- [ ] **Step 2: 更新 `backend/src/routes/admin.ts`**

```ts
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { authRoutes } from './admin/auth';
import { categoriesAdminRoutes } from './admin/categories';
import { tagsAdminRoutes } from './admin/tags';
import type { Db } from '../db';

export function adminRoutes(ctx: Db) {
  const app = new Hono();
  app.route('/', authRoutes(ctx));
  app.use('*', authMiddleware);
  app.route('/', categoriesAdminRoutes(ctx));
  app.route('/', tagsAdminRoutes(ctx));
  return app;
}
```

- [ ] **Step 3: 追加测试到 `backend/test/admin.test.ts`**

```ts
it('标签 CRUD', async () => {
  const headers = { Authorization: `Bearer ${token}` };
  const create = await app.request('/api/admin/tags', {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Vue' }),
  });
  expect(create.status).toBe(201);
  const list = await app.request('/api/admin/tags', { headers });
  const body = await list.json();
  expect(body.data[0].name).toBe('Vue');
});
```

> 注：该用例依赖前一个 describe 的 `token` 变量，将 `let token` 提升到文件顶部模块级，或在 `admin categories` describe 内共用。实施时统一将 token 提升为顶层变量。

- [ ] **Step 4: 运行测试**

Run: `cd backend && npx vitest run test/admin.test.ts`
Expected: 全 PASS。

- [ ] **Step 5: 提交**

```bash
git add backend/src/routes/admin/tags.ts backend/src/routes/admin.ts backend/test/admin.test.ts
git commit -m "feat: 管理端标签 CRUD"
```

### Task 16: 文章服务（创建/更新/删除 + FTS 同步 + 标签）

**Files:**
- Create: `backend/src/services/posts.ts`

- [ ] **Step 1: 创建 `backend/src/services/posts.ts`**

```ts
import { eq } from 'drizzle-orm';
import { posts, postTags } from '../db/schema';
import { renderMarkdown } from './markdown';
import { makeSlug } from '../lib/slug';
import type { Db } from '../db';

export interface PostInput {
  title: string;
  slug?: string;
  contentMd: string;
  summary?: string;
  cover?: string;
  categoryId?: number | null;
  status?: 'draft' | 'published';
  tagIds?: number[];
}

export function syncFts(ctx: Db, post: { id: number; title: string; contentMd: string }): void {
  ctx.sqlite.prepare('DELETE FROM posts_fts WHERE rowid = ?').run(post.id);
  ctx.sqlite.prepare('INSERT INTO posts_fts(rowid, title, content_md) VALUES (?, ?, ?)').run(post.id, post.title, post.contentMd);
}

export function setPostTags(ctx: Db, postId: number, tagIds: number[]): void {
  ctx.db.delete(postTags).where(eq(postTags.postId, postId)).run();
  for (const tagId of tagIds) {
    ctx.db.insert(postTags).values({ postId, tagId }).run();
  }
}

export async function createPost(ctx: Db, input: PostInput): Promise<number> {
  const slug = input.slug?.trim() || makeSlug(input.title);
  const contentHtml = await renderMarkdown(input.contentMd || '');
  const summary = input.summary?.trim() || input.contentMd.slice(0, 150);
  const row = ctx.db.insert(posts).values({
    title: input.title,
    slug,
    contentMd: input.contentMd,
    contentHtml,
    summary,
    cover: input.cover ?? '',
    categoryId: input.categoryId ?? null,
    status: input.status ?? 'draft',
  }).returning({ id: posts.id }).get();
  syncFts(ctx, { id: row.id, title: input.title, contentMd: input.contentMd });
  setPostTags(ctx, row.id, input.tagIds ?? []);
  return row.id;
}

export async function updatePost(ctx: Db, id: number, input: PostInput): Promise<void> {
  const existing = ctx.db.select().from(posts).where(eq(posts.id, id)).get();
  if (!existing) throw new Error('NOT_FOUND');
  const slug = input.slug?.trim() || existing.slug;
  const contentHtml = await renderMarkdown(input.contentMd ?? '');
  ctx.db.update(posts).set({
    title: input.title,
    slug,
    contentMd: input.contentMd,
    contentHtml,
    summary: input.summary?.trim() || input.contentMd.slice(0, 150),
    cover: input.cover ?? '',
    categoryId: input.categoryId ?? null,
    status: input.status ?? existing.status,
    updatedAt: Date.now(),
  }).where(eq(posts.id, id)).run();
  syncFts(ctx, { id, title: input.title, contentMd: input.contentMd });
  setPostTags(ctx, id, input.tagIds ?? []);
}

export function deletePost(ctx: Db, id: number): void {
  ctx.sqlite.prepare('DELETE FROM posts_fts WHERE rowid = ?').run(id);
  ctx.db.delete(postTags).where(eq(postTags.postId, id)).run();
  ctx.db.delete(posts).where(eq(posts.id, id)).run();
}
```

- [ ] **Step 2: 提交**

```bash
git add backend/src/services/posts.ts
git commit -m "feat: 文章服务（Markdown 渲染+FTS同步+标签关联）"
```

### Task 17: 管理端文章 CRUD

**Files:**
- Create: `backend/src/routes/admin/posts.ts`
- Modify: `backend/src/routes/admin.ts`
- Test: `backend/test/admin.test.ts`（追加用例）

- [ ] **Step 1: 创建 `backend/src/routes/admin/posts.ts`**

```ts
import { Hono } from 'hono';
import { eq, desc, count, and } from 'drizzle-orm';
import { posts, tags, postTags } from '../../db/schema';
import { createPost, updatePost, deletePost } from '../../services/posts';
import type { Db } from '../../db';

export function postsAdminRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/posts', (c) => {
    const page = Math.max(1, Number(c.req.query('page') ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(c.req.query('pageSize') ?? 20)));
    const status = c.req.query('status');
    const categoryId = Number(c.req.query('categoryId') ?? 0);

    const conditions = [];
    if (status === 'draft' || status === 'published') conditions.push(eq(posts.status, status));
    if (categoryId) conditions.push(eq(posts.categoryId, categoryId));

    const where = conditions.length ? and(...conditions) : undefined;
    const total = ctx.db.select({ n: count() }).from(posts).where(where).get()?.n ?? 0;
    const list = ctx.db.select().from(posts).where(where)
      .orderBy(desc(posts.updatedAt)).limit(pageSize).offset((page - 1) * pageSize).all();
    return c.json({ data: { list, total } });
  });

  app.get('/posts/:id', (c) => {
    const id = Number(c.req.param('id'));
    const post = ctx.db.select().from(posts).where(eq(posts.id, id)).get();
    if (!post) return c.json({ error: { code: 'NOT_FOUND', message: '文章不存在' } }, 404);
    const tagRows = ctx.db.select({ id: tags.id, name: tags.name, slug: tags.slug })
      .from(postTags).innerJoin(tags, eq(postTags.tagId, tags.id))
      .where(eq(postTags.postId, id)).all();
    return c.json({ data: { ...post, tags: tagRows } });
  });

  app.post('/posts', async (c) => {
    const body = await c.req.json().catch(() => null);
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    if (!title) return c.json({ error: { code: 'INVALID', message: '标题不能为空' } }, 400);
    const id = await createPost(ctx, {
      title,
      slug: typeof body.slug === 'string' ? body.slug : undefined,
      contentMd: typeof body.contentMd === 'string' ? body.contentMd : '',
      summary: typeof body.summary === 'string' ? body.summary : undefined,
      cover: typeof body.cover === 'string' ? body.cover : undefined,
      categoryId: typeof body.categoryId === 'number' ? body.categoryId : null,
      status: body.status === 'published' ? 'published' : 'draft',
      tagIds: Array.isArray(body.tagIds) ? body.tagIds : [],
    });
    return c.json({ data: { id } }, 201);
  });

  app.put('/posts/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => null);
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    if (!title) return c.json({ error: { code: 'INVALID', message: '标题不能为空' } }, 400);
    try {
      await updatePost(ctx, id, {
        title,
        slug: typeof body.slug === 'string' ? body.slug : undefined,
        contentMd: typeof body.contentMd === 'string' ? body.contentMd : '',
        summary: typeof body.summary === 'string' ? body.summary : undefined,
        cover: typeof body.cover === 'string' ? body.cover : undefined,
        categoryId: typeof body.categoryId === 'number' ? body.categoryId : null,
        status: body.status === 'published' ? 'published' : 'draft',
        tagIds: Array.isArray(body.tagIds) ? body.tagIds : [],
      });
    } catch {
      return c.json({ error: { code: 'NOT_FOUND', message: '文章不存在' } }, 404);
    }
    return c.json({ data: { id } });
  });

  app.delete('/posts/:id', (c) => {
    const id = Number(c.req.param('id'));
    deletePost(ctx, id);
    return c.json({ data: { ok: true } });
  });

  return app;
}
```

- [ ] **Step 2: 更新 `backend/src/routes/admin.ts`**

```ts
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { authRoutes } from './admin/auth';
import { categoriesAdminRoutes } from './admin/categories';
import { tagsAdminRoutes } from './admin/tags';
import { postsAdminRoutes } from './admin/posts';
import type { Db } from '../db';

export function adminRoutes(ctx: Db) {
  const app = new Hono();
  app.route('/', authRoutes(ctx));
  app.use('*', authMiddleware);
  app.route('/', categoriesAdminRoutes(ctx));
  app.route('/', tagsAdminRoutes(ctx));
  app.route('/', postsAdminRoutes(ctx));
  return app;
}
```

- [ ] **Step 3: 追加测试到 `backend/test/admin.test.ts`**

```ts
it('文章 CRUD（含 FTS 搜索）', async () => {
  const headers = { Authorization: `Bearer ${token}` };
  const create = await app.request('/api/admin/posts', {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Hello World', contentMd: '# 测试\n\n正文内容', status: 'published' }),
  });
  expect(create.status).toBe(201);

  const detail = await app.request('/api/admin/posts/1', { headers });
  const d = await detail.json();
  expect(d.data.contentHtml).toContain('<h1>测试</h1>');

  const search = await app.request('/api/posts?q=正文', { headers });
  const s = await search.json();
  expect(s.data.total).toBe(1);

  const update = await app.request('/api/admin/posts/1', {
    method: 'PUT', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Hello Updated', contentMd: '新内容', status: 'published' }),
  });
  expect(update.status).toBe(200);

  const del = await app.request('/api/admin/posts/1', { method: 'DELETE', headers });
  expect(del.status).toBe(200);
  const gone = await app.request('/api/posts/hello-updated');
  expect(gone.status).toBe(404);
});
```

- [ ] **Step 4: 运行测试**

Run: `cd backend && npx vitest run`
Expected: 全 PASS。若 `/api/admin/posts` 列表查询报错，按 Step 1 注释修正 `and(...)` 写法。

- [ ] **Step 5: 提交**

```bash
git add backend/src/routes/admin/posts.ts backend/src/routes/admin.ts backend/test/admin.test.ts
git commit -m "feat: 管理端文章 CRUD（草稿/发布）"
```

### Task 18: 管理端评论审核

**Files:**
- Create: `backend/src/routes/admin/comments.ts`
- Modify: `backend/src/routes/admin.ts`
- Test: `backend/test/admin.test.ts`（追加用例）

- [ ] **Step 1: 创建 `backend/src/routes/admin/comments.ts`**

```ts
import { Hono } from 'hono';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { comments } from '../../db/schema';
import type { Db } from '../../db';

export function commentsAdminRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/comments', (c) => {
    const status = c.req.query('status');
    const conditions = [];
    if (status === 'pending' || status === 'approved' || status === 'rejected') {
      conditions.push(eq(comments.status, status));
    }
    const where = and(...conditions);
    const rows = ctx.db.select().from(comments).where(where).orderBy(desc(comments.createdAt)).all();
    return c.json({ data: rows });
  });

  app.patch('/comments/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => null);
    const status = body?.status;
    if (status !== 'approved' && status !== 'rejected' && status !== 'pending') {
      return c.json({ error: { code: 'INVALID', message: '无效状态' } }, 400);
    }
    const row = ctx.db.select().from(comments).where(eq(comments.id, id)).get();
    if (!row) return c.json({ error: { code: 'NOT_FOUND', message: '评论不存在' } }, 404);
    ctx.db.update(comments).set({ status }).where(eq(comments.id, id)).run();
    return c.json({ data: { id, status } });
  });

  app.post('/comments/:id/reply', async (c) => {
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => null);
    const content = typeof body?.content === 'string' ? body.content.trim().slice(0, 2000) : '';
    if (!content) return c.json({ error: { code: 'INVALID', message: '回复内容不能为空' } }, 400);
    const parent = ctx.db.select().from(comments).where(eq(comments.id, id)).get();
    if (!parent) return c.json({ error: { code: 'NOT_FOUND', message: '评论不存在' } }, 404);
    ctx.db.insert(comments).values({
      postId: parent.postId, author: '博主', content, status: 'approved', parentId: id,
    }).run();
    return c.json({ data: { ok: true } }, 201);
  });

  app.post('/comments/batch', async (c) => {
    const body = await c.req.json().catch(() => null);
    const ids = Array.isArray(body?.ids) ? body.ids.map(Number) : [];
    const action = body?.action;
    if (ids.length === 0) return c.json({ error: { code: 'INVALID', message: '缺少 ids' } }, 400);
    if (action === 'delete') {
      ctx.db.delete(comments).where(inArray(comments.id, ids)).run();
    } else if (action === 'approve' || action === 'reject') {
      ctx.db.update(comments).set({ status: action }).where(inArray(comments.id, ids)).run();
    } else {
      return c.json({ error: { code: 'INVALID', message: '无效操作' } }, 400);
    }
    return c.json({ data: { ok: true } });
  });

  app.delete('/comments/:id', (c) => {
    const id = Number(c.req.param('id'));
    ctx.db.delete(comments).where(eq(comments.id, id)).run();
    return c.json({ data: { ok: true } });
  });

  return app;
}
```

- [ ] **Step 2: 更新 `backend/src/routes/admin.ts`**

```ts
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { authRoutes } from './admin/auth';
import { categoriesAdminRoutes } from './admin/categories';
import { tagsAdminRoutes } from './admin/tags';
import { postsAdminRoutes } from './admin/posts';
import { commentsAdminRoutes } from './admin/comments';
import type { Db } from '../db';

export function adminRoutes(ctx: Db) {
  const app = new Hono();
  app.route('/', authRoutes(ctx));
  app.use('*', authMiddleware);
  app.route('/', categoriesAdminRoutes(ctx));
  app.route('/', tagsAdminRoutes(ctx));
  app.route('/', postsAdminRoutes(ctx));
  app.route('/', commentsAdminRoutes(ctx));
  return app;
}
```

- [ ] **Step 3: 追加测试到 `backend/test/admin.test.ts`**

```ts
it('评论审核与批量操作', async () => {
  const headers = { Authorization: `Bearer ${token}` };
  // 先通过公开接口发表一篇待审评论（依赖已发布的文章 id=1）
  await app.request('/api/comments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ postId: 1, author: '访客', content: '好文' }),
  });
  const approve = await app.request('/api/admin/comments/1', {
    method: 'PATCH', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'approved' }),
  });
  expect(approve.status).toBe(200);
  const list = await app.request('/api/admin/comments?status=approved', { headers });
  const body = await list.json();
  expect(body.data.length).toBeGreaterThanOrEqual(1);
});
```

- [ ] **Step 4: 运行测试**

Run: `cd backend && npx vitest run`
Expected: 全 PASS。

- [ ] **Step 5: 提交**

```bash
git add backend/src/routes/admin/comments.ts backend/src/routes/admin.ts backend/test/admin.test.ts
git commit -m "feat: 管理端评论审核/回复/批量"
```

### Task 19: 管理端友链管理

**Files:**
- Create: `backend/src/routes/admin/friendLinks.ts`
- Modify: `backend/src/routes/admin.ts`
- Test: `backend/test/admin.test.ts`（追加用例）

- [ ] **Step 1: 创建 `backend/src/routes/admin/friendLinks.ts`**

```ts
import { Hono } from 'hono';
import { eq, desc, and } from 'drizzle-orm';
import { friendLinks } from '../../db/schema';
import type { Db } from '../../db';

export function friendLinksAdminRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/friend-links', (c) => {
    const status = c.req.query('status');
    const conditions = [];
    if (status === 'pending' || status === 'approved' || status === 'rejected') {
      conditions.push(eq(friendLinks.status, status));
    }
    const rows = ctx.db.select().from(friendLinks).where(and(...conditions)).orderBy(desc(friendLinks.createdAt)).all();
    return c.json({ data: rows });
  });

  app.post('/friend-links', async (c) => {
    const body = await c.req.json().catch(() => null);
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 50) : '';
    const url = typeof body?.url === 'string' ? body.url.trim().slice(0, 300) : '';
    if (!name || !url) return c.json({ error: { code: 'INVALID', message: '站名和网址必填' } }, 400);
    const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 200) : '';
    const avatar = typeof body?.avatar === 'string' ? body.avatar.trim().slice(0, 500) : '';
    const status = body?.status === 'approved' ? 'approved' : 'pending';
    const row = ctx.db.insert(friendLinks).values({ name, url, description, avatar, status }).returning().get();
    return c.json({ data: row }, 201);
  });

  app.put('/friend-links/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => null);
    const row = ctx.db.select().from(friendLinks).where(eq(friendLinks.id, id)).get();
    if (!row) return c.json({ error: { code: 'NOT_FOUND', message: '友链不存在' } }, 404);
    ctx.db.update(friendLinks).set({
      name: typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : row.name,
      url: typeof body?.url === 'string' && body.url.trim() ? body.url.trim() : row.url,
      description: typeof body?.description === 'string' ? body.description.trim() : row.description,
      avatar: typeof body?.avatar === 'string' ? body.avatar.trim() : row.avatar,
      status: body?.status === 'pending' || body?.status === 'approved' || body?.status === 'rejected'
        ? body.status : row.status,
    }).where(eq(friendLinks.id, id)).run();
    return c.json({ data: { id } });
  });

  app.delete('/friend-links/:id', (c) => {
    const id = Number(c.req.param('id'));
    ctx.db.delete(friendLinks).where(eq(friendLinks.id, id)).run();
    return c.json({ data: { ok: true } });
  });

  return app;
}
```

- [ ] **Step 2: 更新 `backend/src/routes/admin.ts`**

```ts
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { authRoutes } from './admin/auth';
import { categoriesAdminRoutes } from './admin/categories';
import { tagsAdminRoutes } from './admin/tags';
import { postsAdminRoutes } from './admin/posts';
import { commentsAdminRoutes } from './admin/comments';
import { friendLinksAdminRoutes } from './admin/friendLinks';
import type { Db } from '../db';

export function adminRoutes(ctx: Db) {
  const app = new Hono();
  app.route('/', authRoutes(ctx));
  app.use('*', authMiddleware);
  app.route('/', categoriesAdminRoutes(ctx));
  app.route('/', tagsAdminRoutes(ctx));
  app.route('/', postsAdminRoutes(ctx));
  app.route('/', commentsAdminRoutes(ctx));
  app.route('/', friendLinksAdminRoutes(ctx));
  return app;
}
```

- [ ] **Step 3: 追加测试到 `backend/test/admin.test.ts`**

```ts
it('友链审核', async () => {
  const headers = { Authorization: `Bearer ${token}` };
  await app.request('/api/friend-links', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '待审站', url: 'https://pending.example' }),
  });
  const approve = await app.request('/api/admin/friend-links/1', {
    method: 'PUT', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'approved' }),
  });
  expect(approve.status).toBe(200);
  const pub = await app.request('/api/friend-links');
  const body = await pub.json();
  expect(body.data).toHaveLength(1);
});
```

- [ ] **Step 4: 运行测试**

Run: `cd backend && npx vitest run`
Expected: 全 PASS。

- [ ] **Step 5: 提交**

```bash
git add backend/src/routes/admin/friendLinks.ts backend/src/routes/admin.ts backend/test/admin.test.ts
git commit -m "feat: 管理端友链管理（审核/CRUD）"
```

### Task 20: 存储抽象层（本地磁盘 + 腾讯云 COS）

**Files:**
- Create: `backend/src/storage/index.ts`
- Create: `backend/src/storage/local.ts`
- Create: `backend/src/storage/cos.ts`
- Test: `backend/test/storage.test.ts`

- [ ] **Step 1: 创建 `backend/src/storage/index.ts`**

```ts
import { getSetting } from '../lib/settings';
import { LocalStorage } from './local';
import { COSStorage } from './cos';
import type { Db } from '../db';

export interface UploadInput {
  filename: string;
  mime: string;
  buffer: Buffer;
}

export interface StorageResult {
  url: string;
  key: string;
}

export interface StorageProvider {
  readonly type: 'local' | 'cos';
  upload(input: UploadInput): Promise<StorageResult>;
  delete(key: string): Promise<void>;
}

/** 依据后台设置选择存储实现。 */
export function getStorage(ctx: Db): StorageProvider {
  const provider = getSetting(ctx, 'storage_provider');
  if (provider === 'cos') {
    return new COSStorage({
      secretId: getSetting(ctx, 'cos_secret_id'),
      secretKey: getSetting(ctx, 'cos_secret_key'),
      bucket: getSetting(ctx, 'cos_bucket'),
      region: getSetting(ctx, 'cos_region'),
    });
  }
  return new LocalStorage();
}
```

- [ ] **Step 2: 创建 `backend/src/storage/local.ts`**

```ts
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import type { StorageProvider, StorageResult, UploadInput } from './index';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? 'uploads';

export class LocalStorage implements StorageProvider {
  readonly type = 'local' as const;

  async upload(input: UploadInput): Promise<StorageResult> {
    const ext = path.extname(input.filename).toLowerCase().slice(0, 10);
    const key = `${Date.now()}-${randomUUID()}${ext}`;
    const fullPath = path.join(UPLOAD_DIR, key);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, input.buffer);
    return { url: `/uploads/${key}`, key };
  }

  async delete(key: string): Promise<void> {
    await rm(path.join(UPLOAD_DIR, path.basename(key)), { force: true });
  }
}
```

- [ ] **Step 3: 创建 `backend/src/storage/cos.ts`**

```ts
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import COS from 'cos-nodejs-sdk-v5';
import type { StorageProvider, StorageResult, UploadInput } from './index';

interface COSConfig {
  secretId: string;
  secretKey: string;
  bucket: string;
  region: string;
}

export class COSStorage implements StorageProvider {
  readonly type = 'cos' as const;
  private cos: COS;

  constructor(private config: COSConfig) {
    this.cos = new COS({ SecretId: config.secretId, SecretKey: config.secretKey });
  }

  private get baseUrl(): string {
    return `https://${this.config.bucket}.cos.${this.config.region}.myqcloud.com`;
  }

  async upload(input: UploadInput): Promise<StorageResult> {
    const ext = path.extname(input.filename).toLowerCase().slice(0, 10);
    const key = `uploads/${Date.now()}-${randomUUID()}${ext}`;
    await this.cos.putObject({
      Bucket: this.config.bucket,
      Region: this.config.region,
      Key: key,
      Body: input.buffer,
    });
    return { url: `${this.baseUrl}/${key}`, key };
  }

  async delete(key: string): Promise<void> {
    await this.cos.deleteObject({
      Bucket: this.config.bucket,
      Region: this.config.region,
      Key: key,
    });
  }
}
```

- [ ] **Step 4: 创建 `backend/test/storage.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LocalStorage } from '../src/storage/local';

describe('LocalStorage', () => {
  it('上传写入文件并返回 URL，删除后文件消失', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'mblog-test-'));
    process.env.UPLOAD_DIR = dir;
    const storage = new LocalStorage();
    const result = await storage.upload({ filename: 'a.png', mime: 'image/png', buffer: Buffer.from('x') });
    expect(result.url).toMatch(/^\/uploads\//);
    const st = await stat(path.join(dir, result.key));
    expect(st.size).toBe(1);
    await storage.delete(result.key);
    await expect(stat(path.join(dir, result.key))).rejects.toThrow();
    await rm(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 5: 运行测试**

Run: `cd backend && npx vitest run test/storage.test.ts`
Expected: 1 条 PASS。

- [ ] **Step 6: 提交**

```bash
git add backend/src/storage/index.ts backend/src/storage/local.ts backend/src/storage/cos.ts backend/test/storage.test.ts
git commit -m "feat: 存储抽象层（本地/COS）"
```

### Task 21: 管理端上传、媒体库与统计

**Files:**
- Create: `backend/src/routes/admin/upload.ts`
- Modify: `backend/src/routes/admin.ts`
- Test: `backend/test/admin.test.ts`（追加用例）

- [ ] **Step 1: 创建 `backend/src/routes/admin/upload.ts`**

```ts
import { Hono } from 'hono';
import { eq, desc, count } from 'drizzle-orm';
import { mediaFiles, posts, comments } from '../../db/schema';
import { getStorage } from '../../storage';
import type { Db } from '../../db';

const MAX_SIZES: Record<string, number> = {
  'image/png': 10 * 1024 * 1024,
  'image/jpeg': 10 * 1024 * 1024,
  'image/gif': 10 * 1024 * 1024,
  'image/webp': 10 * 1024 * 1024,
  'image/svg+xml': 1 * 1024 * 1024,
  'audio/mpeg': 50 * 1024 * 1024,
  'audio/ogg': 50 * 1024 * 1024,
  'audio/wav': 50 * 1024 * 1024,
  'audio/mp4': 50 * 1024 * 1024,
};

export function uploadAdminRoutes(ctx: Db) {
  const app = new Hono();

  app.post('/upload', async (c) => {
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) {
      return c.json({ error: { code: 'INVALID', message: '缺少文件（字段名 file）' } }, 400);
    }
    const maxSize = MAX_SIZES[file.type];
    if (!maxSize) return c.json({ error: { code: 'INVALID', message: `不支持的文件类型: ${file.type}` } }, 400);
    if (file.size > maxSize) return c.json({ error: { code: 'INVALID', message: '文件过大' } }, 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const storage = getStorage(ctx);
    const result = await storage.upload({ filename: file.name, mime: file.type, buffer });
    ctx.db.insert(mediaFiles).values({
      filename: file.name, url: result.url, key: result.key,
      size: file.size, mime: file.type, storage: storage.type,
    }).run();
    return c.json({ data: result }, 201);
  });

  app.get('/media', (c) => {
    const page = Math.max(1, Number(c.req.query('page') ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(c.req.query('pageSize') ?? 30)));
    const total = ctx.db.select({ n: count() }).from(mediaFiles).get()?.n ?? 0;
    const list = ctx.db.select().from(mediaFiles).orderBy(desc(mediaFiles.createdAt))
      .limit(pageSize).offset((page - 1) * pageSize).all();
    return c.json({ data: { list, total } });
  });

  app.delete('/media/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const row = ctx.db.select().from(mediaFiles).where(eq(mediaFiles.id, id)).get();
    if (!row) return c.json({ error: { code: 'NOT_FOUND', message: '文件不存在' } }, 404);
    await getStorage(ctx).delete(row.key).catch(() => {});
    ctx.db.delete(mediaFiles).where(eq(mediaFiles.id, id)).run();
    return c.json({ data: { ok: true } });
  });

  app.get('/stats', (c) => {
    const postTotal = ctx.db.select({ n: count() }).from(posts).get()?.n ?? 0;
    const published = ctx.db.select({ n: count() }).from(posts).where(eq(posts.status, 'published')).get()?.n ?? 0;
    const commentTotal = ctx.db.select({ n: count() }).from(comments).get()?.n ?? 0;
    const pendingComments = ctx.db.select({ n: count() }).from(comments).where(eq(comments.status, 'pending')).get()?.n ?? 0;
    const totalViews = ctx.db.select({ n: posts.viewCount }).from(posts).all().reduce((s, r) => s + r.n, 0);
    return c.json({ data: { postTotal, published, commentTotal, pendingComments, totalViews } });
  });

  return app;
}
```

- [ ] **Step 2: 更新 `backend/src/routes/admin.ts`**

```ts
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { authRoutes } from './admin/auth';
import { categoriesAdminRoutes } from './admin/categories';
import { tagsAdminRoutes } from './admin/tags';
import { postsAdminRoutes } from './admin/posts';
import { commentsAdminRoutes } from './admin/comments';
import { friendLinksAdminRoutes } from './admin/friendLinks';
import { uploadAdminRoutes } from './admin/upload';
import type { Db } from '../db';

export function adminRoutes(ctx: Db) {
  const app = new Hono();
  app.route('/', authRoutes(ctx));
  app.use('*', authMiddleware);
  app.route('/', categoriesAdminRoutes(ctx));
  app.route('/', tagsAdminRoutes(ctx));
  app.route('/', postsAdminRoutes(ctx));
  app.route('/', commentsAdminRoutes(ctx));
  app.route('/', friendLinksAdminRoutes(ctx));
  app.route('/', uploadAdminRoutes(ctx));
  return app;
}
```

- [ ] **Step 3: 追加测试到 `backend/test/admin.test.ts`**

```ts
it('统计接口', async () => {
  const headers = { Authorization: `Bearer ${token}` };
  const res = await app.request('/api/admin/stats', { headers });
  const body = await res.json();
  expect(body.data).toHaveProperty('postTotal');
});
```

- [ ] **Step 4: 运行测试**

Run: `cd backend && npx vitest run`
Expected: 全 PASS。

- [ ] **Step 5: 提交**

```bash
git add backend/src/routes/admin/upload.ts backend/src/routes/admin.ts backend/test/admin.test.ts
git commit -m "feat: 管理端上传/媒体库/统计"
```

### Task 22: 管理端设置读写

**Files:**
- Create: `backend/src/routes/admin/settings.ts`
- Modify: `backend/src/routes/admin.ts`
- Test: `backend/test/admin.test.ts`（追加用例）

- [ ] **Step 1: 创建 `backend/src/routes/admin/settings.ts`**

```ts
import { Hono } from 'hono';
import { getSettings, setSetting, DEFAULT_SETTINGS } from '../../lib/settings';
import type { Db } from '../../db';

// 密文掩码约定：GET 返回占位符，PUT 收到占位符时保留原值
const MASK = '********';

export function settingsAdminRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/settings', (c) => {
    const keys = Object.keys(DEFAULT_SETTINGS);
    const data = getSettings(ctx, keys);
    if (data.cos_secret_key) data.cos_secret_key = MASK;
    return c.json({ data });
  });

  app.put('/settings', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return c.json({ error: { code: 'INVALID', message: '参数错误' } }, 400);
    }
    const allowed = new Set(Object.keys(DEFAULT_SETTINGS));
    for (const [key, value] of Object.entries(body)) {
      if (!allowed.has(key) || typeof value !== 'string') continue;
      // 掩码占位符 → 保留已存密钥
      if (key === 'cos_secret_key' && value === MASK) continue;
      setSetting(ctx, key, value);
    }
    const data = getSettings(ctx, Object.keys(DEFAULT_SETTINGS));
    if (data.cos_secret_key) data.cos_secret_key = MASK;
    return c.json({ data });
  });

  return app;
}
```

- [ ] **Step 2: 更新 `backend/src/routes/admin.ts`**

```ts
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { authRoutes } from './admin/auth';
import { categoriesAdminRoutes } from './admin/categories';
import { tagsAdminRoutes } from './admin/tags';
import { postsAdminRoutes } from './admin/posts';
import { commentsAdminRoutes } from './admin/comments';
import { friendLinksAdminRoutes } from './admin/friendLinks';
import { uploadAdminRoutes } from './admin/upload';
import { settingsAdminRoutes } from './admin/settings';
import type { Db } from '../db';

export function adminRoutes(ctx: Db) {
  const app = new Hono();
  app.route('/', authRoutes(ctx));
  app.use('*', authMiddleware);
  app.route('/', categoriesAdminRoutes(ctx));
  app.route('/', tagsAdminRoutes(ctx));
  app.route('/', postsAdminRoutes(ctx));
  app.route('/', commentsAdminRoutes(ctx));
  app.route('/', friendLinksAdminRoutes(ctx));
  app.route('/', uploadAdminRoutes(ctx));
  app.route('/', settingsAdminRoutes(ctx));
  return app;
}
```

- [ ] **Step 3: 追加测试到 `backend/test/admin.test.ts`**

```ts
it('设置读写', async () => {
  const headers = { Authorization: `Bearer ${token}` };
  const put = await app.request('/api/admin/settings', {
    method: 'PUT', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ site_name: '我的新博客', default_theme: 'reader' }),
  });
  expect(put.status).toBe(200);
  const body = await put.json();
  expect(body.data.site_name).toBe('我的新博客');
  const pub = await app.request('/api/settings/public');
  const pubBody = await pub.json();
  expect(pubBody.data.theme).toBe('reader');
});
```

- [ ] **Step 4: 运行测试**

Run: `cd backend && npx vitest run`
Expected: 全 PASS。

- [ ] **Step 5: 提交**

```bash
git add backend/src/routes/admin/settings.ts backend/src/routes/admin.ts backend/test/admin.test.ts
git commit -m "feat: 管理端设置读写"
```

### Task 23: 后端里程碑验收（M1–M3 全量回归）

**Files:**
- Modify: `backend/test/admin.test.ts`（如 token 仍是局部变量则提升为顶层）

- [ ] **Step 1: 检查测试质量**

打开 `backend/test/admin.test.ts`，确认：
- 文件顶部有一个模块级 `let token = ''` 与 `beforeAll` 登录逻辑，所有 admin describe 复用同一 token（避免每个用例重复登录）。
- 无 `it.only` / 跳过用例。

- [ ] **Step 2: 全量回归**

Run: `cd backend && npx vitest run`
Expected: 全部测试 PASS（约 20+ 用例）。

- [ ] **Step 3: 手动冒烟启动服务**

```bash
cd backend && npm run dev
```

另开终端验证：
```bash
curl -s http://localhost:3000/api/health
curl -s http://localhost:3000/api/settings/public
```
Expected: 返回 JSON；`{"data":{"status":"ok"}}` 与站点信息。测试完成后用 Ctrl+C 停止服务。

- [ ] **Step 4: 提交**

```bash
git add backend/test/admin.test.ts
git commit -m "test: 后端 M1-M3 验收回归"
```

---

# M4 前端骨架（Astro 前台 + Vue 后台）

> 架构：`site/` = Astro 5 SSR 前台（Vue islands 做交互）；`admin/` = Vue 3 SPA 后台（Vite，base=/admin/）。后端 Hono API 不变，前后端经 REST 通信。前台服务端渲染页面由 Astro 直接 fetch Hono API（`API_BASE`），客户端交互（评论/主题切换/友链表单）用相对路径 `/api/*`（dev 由 Vite proxy 转发，prod 由 Nginx 转发）。

### Task 24: 初始化 Astro 前台项目（site/）

**Files:**
- Create: `site/package.json`
- Create: `site/astro.config.mjs`
- Create: `site/tsconfig.json`

- [ ] **Step 1: 创建 `site/package.json`**

```json
{
  "name": "mblog-site",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check"
  },
  "dependencies": {
    "@astrojs/node": "^9.0.0",
    "@astrojs/vue": "^5.0.0",
    "astro": "^5.1.0",
    "highlight.js": "^11.10.0",
    "lenis": "^1.3.25",
    "vue": "^3.5.13"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.4",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: 创建 `site/astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import vue from '@astrojs/vue';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [vue()],
  server: { port: 4321 },
  // 开发环境：把 /api 与 /uploads 代理到本地 Hono 后端
  vite: {
    server: {
      proxy: {
        '/api': 'http://localhost:3000',
        '/uploads': 'http://localhost:3000',
      },
    },
  },
});
```

- [ ] **Step 3: 创建 `site/tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/base",
  "include": [".astro/types.d.ts", "src/**/*"],
  "exclude": ["dist"]
}
```

- [ ] **Step 4: 创建最小页面验证可运行**

创建 `site/src/pages/index.astro`（临时占位，后续 Task 28 覆盖）：
```astro
---
const siteName = 'MBLOG';
---
<html lang="zh-CN">
  <head><meta charset="UTF-8" /><title>{siteName}</title></head>
  <body><h1>{siteName}</h1><p>Astro SSR 运行正常</p></body>
</html>
```

Run: `cd site && npm install && npm run build`
Expected: 构建成功，产物含 `dist/server/entry.mjs`（node standalone 入口）。

Run: `cd site && npm run preview`
Expected: 打开 `http://localhost:4321` 显示 "Astro SSR 运行正常"。验证后 Ctrl+C 停止。

- [ ] **Step 5: 提交**

```bash
git add site/package.json site/package-lock.json site/astro.config.mjs site/tsconfig.json site/src/pages/index.astro
git commit -m "chore: 初始化 Astro 前台项目（SSR + node adapter + vue integration）"
```

### Task 25: 初始化 Vue 后台项目（admin/）

**Files:**
- Create: `admin/package.json`
- Create: `admin/vite.config.ts`
- Create: `admin/tsconfig.json`
- Create: `admin/index.html`

- [ ] **Step 1: 创建 `admin/package.json`**

```json
{
  "name": "mblog-admin",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "vue-tsc --noEmit"
  },
  "dependencies": {
    "highlight.js": "^11.10.0",
    "vditor": "^3.10.9",
    "vue": "^3.5.13",
    "vue-router": "^4.5.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "@vitejs/plugin-vue": "^5.2.1",
    "typescript": "^5.7.2",
    "vite": "^6.0.5",
    "vue-tsc": "^2.1.10"
  }
}
```

- [ ] **Step 2: 创建 `admin/vite.config.ts`（base=/admin/，与 Nginx 路由一致）**

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  base: '/admin/',
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
    },
  },
});
```

- [ ] **Step 3: 创建 `admin/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "jsx": "preserve",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "vite.config.ts"]
}
```

- [ ] **Step 4: 创建 `admin/index.html`**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MBLOG 后台</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: 安装依赖并验证**

Run: `cd admin && npm install`
Expected: 安装成功，无报错。

- [ ] **Step 6: 提交**

```bash
git add admin/package.json admin/package-lock.json admin/vite.config.ts admin/tsconfig.json admin/index.html
git commit -m "chore: 初始化 Vue 后台项目（base=/admin/）"
```

### Task 26: 主题系统 + BaseLayout + ThemeToggle + Lenis

**Files:**
- Create: `site/src/styles/themes/tokens.css`
- Create: `site/src/styles/themes/normal.css`
- Create: `site/src/styles/themes/reader.css`
- Create: `site/src/layouts/BaseLayout.astro`
- Create: `site/src/components/ThemeToggle.vue`
- Create: `site/src/scripts/lenis.ts`

- [ ] **Step 1: 创建 `site/src/styles/themes/tokens.css`**

```css
:root {
  --font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
    'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  --font-mono: 'SF Mono', 'JetBrains Mono', Consolas, 'Courier New', monospace;
  --font-size: 16px;
  --line-height: 1.7;
}
```

- [ ] **Step 2: 创建 `site/src/styles/themes/normal.css`**

```css
[data-theme='normal'] {
  --color-bg: #f5f6f8;
  --color-surface: #ffffff;
  --color-text: #1f2328;
  --color-text-muted: #6b7280;
  --color-primary: #3b82f6;
  --color-primary-contrast: #ffffff;
  --color-border: #e5e7eb;
  --color-code-bg: #f3f4f6;
  --radius: 10px;
  --max-width: 960px;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  --card-padding: 24px;
}

[data-theme='normal'] body {
  background: var(--color-bg);
  color: var(--color-text);
}

[data-theme='normal'] .post-card {
  background: var(--color-surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  border: 1px solid var(--color-border);
}
```

- [ ] **Step 3: 创建 `site/src/styles/themes/reader.css`**

```css
[data-theme='reader'] {
  --color-bg: #faf9f7;
  --color-surface: transparent;
  --color-text: #2b2b2b;
  --color-text-muted: #8a8a8a;
  --color-primary: #8b5cf6;
  --color-primary-contrast: #ffffff;
  --color-border: #ececec;
  --color-code-bg: #f4f2ee;
  --radius: 0;
  --max-width: 680px;
  --shadow: none;
  --card-padding: 8px 0;
}

[data-theme='reader'] body {
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 18px;
  line-height: 1.9;
}

[data-theme='reader'] .site-header,
[data-theme='reader'] .site-footer {
  border-color: var(--color-border);
}

[data-theme='reader'] .post-card {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  border-radius: 0;
  box-shadow: none;
  padding: 32px 0;
}
```

- [ ] **Step 4: 创建 `site/src/layouts/BaseLayout.astro`**

```astro
---
import '../styles/themes/tokens.css';
import '../styles/themes/normal.css';
import '../styles/themes/reader.css';
import 'highlight.js/styles/github.css';
import ThemeToggle from '../components/ThemeToggle.vue';
import { getPublicSettings } from '../lib/api';

interface Props {
  title?: string;
  description?: string;
}

const { title = '', description = '' } = Astro.props;
// 服务端读取默认主题，直接注入 <html data-theme>，避免闪烁
const settings = await getPublicSettings();
const siteName = settings.siteName || '我的博客';
const defaultTheme = settings.theme || 'normal';
const year = new Date().getFullYear();
---
<!doctype html>
<html lang="zh-CN" data-theme={defaultTheme}>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title ? `${title} · ${siteName}` : siteName}</title>
    <meta name="description" content={description} />
  </head>
  <body>
    <header class="site-header">
      <div class="inner">
        <a class="brand" href="/">{siteName}</a>
        <nav class="nav">
          <a href="/">首页</a>
          <a href="/archive">归档</a>
          <a href="/friends">友链</a>
          <a href="/api/rss" target="_blank" rel="noopener">RSS</a>
          <ThemeToggle client:load />
        </nav>
      </div>
    </header>
    <main class="site-main"><slot /></main>
    <footer class="site-footer">
      <span>© {year} {siteName}</span>
      <span class="footer-right">Powered by MBLOG</span>
    </footer>
    <script>
      import '../scripts/lenis.ts';
    </script>
  </body>
</html>

<style is:global>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: var(--font-body);
    font-size: var(--font-size);
    line-height: var(--line-height);
    -webkit-font-smoothing: antialiased;
  }
  a { color: var(--color-primary); }
  .site-header { background: var(--color-surface); border-bottom: 1px solid var(--color-border); }
  .inner {
    max-width: var(--max-width);
    margin: 0 auto;
    padding: 0 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 56px;
  }
  .brand { font-weight: 700; font-size: 18px; text-decoration: none; color: var(--color-text); }
  .nav { display: flex; gap: 16px; align-items: center; }
  .nav a { color: var(--color-text-muted); text-decoration: none; font-size: 14px; }
  .nav a:hover { color: var(--color-primary); }
  .site-main { min-height: calc(100vh - 120px); }
  .site-footer {
    border-top: 1px solid var(--color-border);
    padding: 20px;
    display: flex;
    justify-content: space-between;
    color: var(--color-text-muted);
    font-size: 14px;
    max-width: var(--max-width);
    margin: 0 auto;
  }
  /* markdown 正文排版 */
  .markdown-body { line-height: var(--line-height); word-break: break-word; }
  .markdown-body h1, .markdown-body h2, .markdown-body h3 { margin: 1.4em 0 0.6em; line-height: 1.4; }
  .markdown-body p { margin: 0.8em 0; }
  .markdown-body code { background: var(--color-code-bg); border-radius: 4px; padding: 2px 5px; font-family: var(--font-mono); font-size: 0.9em; }
  .markdown-body pre { background: var(--color-code-bg); padding: 16px; border-radius: var(--radius); overflow-x: auto; }
  .markdown-body pre code { background: transparent; padding: 0; }
  .markdown-body img { max-width: 100%; border-radius: var(--radius); }
  .markdown-body audio { max-width: 100%; margin: 0.8em 0; }
  .markdown-body blockquote { margin: 0.8em 0; padding-left: 14px; border-left: 3px solid var(--color-border); color: var(--color-text-muted); }
  .markdown-body table { border-collapse: collapse; margin: 0.8em 0; width: 100%; }
  .markdown-body th, .markdown-body td { border: 1px solid var(--color-border); padding: 8px 12px; }
  /* 文章列表卡片 */
  .post-list { display: flex; flex-direction: column; gap: 16px; }
  .post-card { padding: var(--card-padding); }
  .post-card .post-title { margin: 0 0 8px; font-size: 20px; }
  .post-card .post-title a { color: var(--color-text); text-decoration: none; }
  .post-card .post-title a:hover { color: var(--color-primary); }
  .post-card .post-summary { color: var(--color-text-muted); margin: 0 0 12px; font-size: 14px; line-height: 1.6; }
  .post-meta { display: flex; gap: 16px; flex-wrap: wrap; color: var(--color-text-muted); font-size: 13px; align-items: center; }
  .post-empty { text-align: center; color: var(--color-text-muted); padding: 48px 0; }
</style>
```

- [ ] **Step 5: 创建 `site/src/components/ThemeToggle.vue`（Vue island）**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';

const THEME_KEY = 'mblog_theme';
const current = ref('normal');

function apply(t: string) {
  current.value = t;
  localStorage.setItem(THEME_KEY, t);
  document.documentElement.setAttribute('data-theme', t);
}
function toggle() {
  apply(current.value === 'normal' ? 'reader' : 'normal');
}
// onMounted 内读 localStorage，避免 SSR 期访问 window
onMounted(() => {
  current.value =
    localStorage.getItem(THEME_KEY) ??
    document.documentElement.getAttribute('data-theme') ??
    'normal';
});
</script>

<template>
  <button class="theme-toggle" type="button" @click="toggle">
    {{ current === 'normal' ? '📖 阅读模式' : '🌐 正常模式' }}
  </button>
</template>

<style scoped>
.theme-toggle {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  border-radius: var(--radius);
  padding: 4px 10px;
  cursor: pointer;
  font-size: 13px;
}
.theme-toggle:hover { color: var(--color-primary); border-color: var(--color-primary); }
</style>
```

- [ ] **Step 6: 创建 `site/src/scripts/lenis.ts`（平滑滚动，随主题开关）**

```ts
import Lenis from 'lenis';

/**
 * Lenis 平滑滚动：正常主题启用；阅读模式（data-theme=reader）恢复原生滚动。
 */
function init() {
  const html = document.documentElement;
  let lenis: Lenis | null = null;

  function apply() {
    if (html.dataset.theme === 'normal') {
      if (!lenis) lenis = new Lenis({ autoRaf: true });
      lenis.start();
    } else {
      lenis?.stop();
    }
  }

  apply();
  const observer = new MutationObserver(apply);
  observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
}

init();
```

- [ ] **Step 7: 创建 `site/src/lib/api.ts`（服务端 API 封装，供页面/布局使用）**

```ts
// 服务端渲染时使用；生产容器内经环境变量指向 mblog-api 服务
const API_BASE = process.env.API_BASE ?? 'http://localhost:3000';

export interface PostListItem {
  id: number; title: string; slug: string; summary: string; cover: string;
  viewCount: number; categoryId: number | null; createdAt: number;
}
export interface PostDetail extends PostListItem {
  contentHtml: string;
  tags: { name: string; slug: string }[];
  category: { id: number; name: string; slug: string } | null;
}
export interface Page<T> { list: T[]; total: number }
export interface PublicSettings { siteName: string; siteDesc: string; theme: string; friendLinkEnabled: boolean }
export interface Category { id: number; name: string; slug: string; postCount: number }
export interface Tag { id: number; name: string; slug: string; postCount: number }
export interface ArchiveGroup { month: string; items: { createdAt: number; title: string; slug: string }[] }
export interface CommentItem {
  id: number; postId: number; author: string; email: string; content: string;
  status: string; parentId: number | null; createdAt: number;
}
export interface FriendLink { id: number; name: string; url: string; description: string; avatar: string }

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`API ${path} -> ${res.status}`);
  const body = (await res.json()) as { data: T };
  return body.data;
}

export function getPublicSettings(): Promise<PublicSettings> {
  return get<PublicSettings>('/settings/public').catch(() => ({
    siteName: '我的博客', siteDesc: '', theme: 'normal', friendLinkEnabled: true,
  }));
}

export function getPosts(params: { page?: number; category?: string; tag?: string; q?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.category) qs.set('category', params.category);
  if (params.tag) qs.set('tag', params.tag);
  if (params.q) qs.set('q', params.q);
  return get<Page<PostListItem>>(`/posts?${qs.toString()}`);
}
export const getPost = (slug: string) => get<PostDetail>(`/posts/${slug}`);
export const getCategories = () => get<Category[]>('/categories');
export const getTags = () => get<Tag[]>('/tags');
export const getArchive = () => get<ArchiveGroup[]>('/archive');
export const getApprovedComments = (postId: number) => get<CommentItem[]>(`/comments?post_id=${postId}`);
export const getFriendLinks = () => get<FriendLink[]>('/friend-links');
```

- [ ] **Step 8: 构建验证**

Run: `cd site && npm run build`
Expected: 构建成功（`getPublicSettings` 有 catch 兜底，API 不在线也能构建）。

- [ ] **Step 9: 提交**

```bash
git add site/src/styles site/src/layouts site/src/components/ThemeToggle.vue site/src/scripts site/src/lib
git commit -m "feat: 双主题 CSS + BaseLayout（服务端默认主题）+ ThemeToggle island + Lenis"
```

### Task 27: 后台路由与 API 客户端

**Files:**
- Create: `admin/src/main.ts`
- Create: `admin/src/App.vue`
- Create: `admin/src/router/index.ts`
- Create: `admin/src/api/client.ts`
- Create: `admin/src/api/posts.ts`
- Create: `admin/src/api/admin.ts`

- [ ] **Step 1: 创建 `admin/src/main.ts`**

```ts
import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';

createApp(App).use(router).mount('#app');
```

- [ ] **Step 2: 创建 `admin/src/App.vue`**

```vue
<template>
  <router-view />
</template>
```

- [ ] **Step 3: 创建 `admin/src/router/index.ts`（base=/admin/ + 登录守卫）**

```ts
import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: () => import('../views/Login.vue') },
    {
      path: '/',
      component: () => import('../views/AdminLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'dashboard', component: () => import('../views/Dashboard.vue') },
        { path: 'posts', name: 'admin-posts', component: () => import('../views/PostList.vue') },
        { path: 'posts/new', name: 'admin-post-new', component: () => import('../views/PostEditor.vue') },
        { path: 'posts/:id', name: 'admin-post-edit', component: () => import('../views/PostEditor.vue') },
        { path: 'categories', name: 'admin-categories', component: () => import('../views/CategoryManager.vue') },
        { path: 'tags', name: 'admin-tags', component: () => import('../views/TagManager.vue') },
        { path: 'comments', name: 'admin-comments', component: () => import('../views/CommentManager.vue') },
        { path: 'friends', name: 'admin-friends', component: () => import('../views/FriendLinkManager.vue') },
        { path: 'settings', name: 'admin-settings', component: () => import('../views/SettingsPage.vue') },
      ],
    },
  ],
});

router.beforeEach((to) => {
  const token = localStorage.getItem('admin_token');
  if (to.meta.requiresAuth && !token) return { name: 'login' };
  if (to.name === 'login' && token) return { name: 'dashboard' };
});
```

> 注：`views/*.vue` 页面在 M6 任务中创建，本任务提交时路由指向未创建文件不影响（Vue Router 懒加载按需引入）。

- [ ] **Step 4: 创建 `admin/src/api/client.ts`**

```ts
const BASE = '/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('admin_token');
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(BASE + path, { ...options, headers });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body?.error?.message ?? `请求失败 (${res.status})`);
  }
  return body.data as T;
}
```

- [ ] **Step 5: 创建 `admin/src/api/posts.ts`（公开类型，供 admin 复用）**

```ts
export interface PostListItem {
  id: number; title: string; slug: string; summary: string; cover: string;
  viewCount: number; categoryId: number | null; createdAt: number;
}
export interface PostDetail extends PostListItem {
  contentMd: string;
  contentHtml: string;
  status: 'draft' | 'published';
  tags: { id: number; name: string; slug: string }[];
  category: { id: number; name: string; slug: string } | null;
}
export interface Page<T> { list: T[]; total: number }
```

- [ ] **Step 6: 创建 `admin/src/api/admin.ts`**

```ts
import { request } from './client';
import type { PostDetail, Page } from './posts';

export interface CategoryRow { id: number; name: string; slug: string; sortOrder: number; postCount: number }
export interface TagRow { id: number; name: string; slug: string; postCount: number }
export interface CommentRow {
  id: number; postId: number; author: string; email: string; content: string;
  status: 'pending' | 'approved' | 'rejected'; parentId: number | null; createdAt: number;
}
export interface FriendLinkRow {
  id: number; name: string; url: string; description: string; avatar: string;
  status: 'pending' | 'approved' | 'rejected'; createdAt: number;
}
export interface AdminPostRow {
  id: number; title: string; slug: string; status: 'draft' | 'published';
  categoryId: number | null; viewCount: number; createdAt: number; updatedAt: number;
}
export interface AdminPostDetail extends Omit<PostDetail, 'tags'> {
  tags: { id: number; name: string; slug: string }[];
}

export function login(username: string, password: string) {
  return request<{ token: string }>('/admin/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}
export function logout() {
  localStorage.removeItem('admin_token');
}

export function getStats() {
  return request<{ postTotal: number; published: number; commentTotal: number; pendingComments: number; totalViews: number }>('/admin/stats');
}

export function adminGetPosts(params: { page?: number; status?: string; categoryId?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.status) qs.set('status', params.status);
  if (params.categoryId) qs.set('categoryId', String(params.categoryId));
  return request<Page<AdminPostRow>>(`/admin/posts?${qs.toString()}`);
}
export function adminGetPost(id: number) {
  return request<AdminPostDetail>(`/admin/posts/${id}`);
}
export interface PostPayload {
  title: string; slug?: string; contentMd: string; summary?: string; cover?: string;
  categoryId?: number | null; status?: 'draft' | 'published'; tagIds?: number[];
}
export function adminCreatePost(payload: PostPayload) {
  return request<{ id: number }>('/admin/posts', { method: 'POST', body: JSON.stringify(payload) });
}
export function adminUpdatePost(id: number, payload: PostPayload) {
  return request<{ id: number }>(`/admin/posts/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}
export function adminDeletePost(id: number) {
  return request<{ ok: true }>(`/admin/posts/${id}`, { method: 'DELETE' });
}

export function adminGetComments(params: { status?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  return request<CommentRow[]>(`/admin/comments?${qs.toString()}`);
}
export function adminPatchComment(id: number, status: CommentRow['status']) {
  return request<{ id: number; status: string }>(`/admin/comments/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
}
export function adminDeleteComment(id: number) {
  return request<{ ok: true }>(`/admin/comments/${id}`, { method: 'DELETE' });
}

export function adminGetFriendLinks(params: { status?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  return request<FriendLinkRow[]>(`/admin/friend-links?${qs.toString()}`);
}
export function adminPutFriendLink(id: number, payload: Partial<FriendLinkRow>) {
  return request<{ id: number }>(`/admin/friend-links/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}
export function adminDeleteFriendLink(id: number) {
  return request<{ ok: true }>(`/admin/friend-links/${id}`, { method: 'DELETE' });
}

export function adminGetCategories(): Promise<CategoryRow[]> { return request('/admin/categories'); }
export function adminCreateCategory(payload: { name: string; slug?: string; sortOrder?: number }) {
  return request<CategoryRow>('/admin/categories', { method: 'POST', body: JSON.stringify(payload) });
}
export function adminUpdateCategory(id: number, payload: Partial<CategoryRow>) {
  return request<{ id: number }>(`/admin/categories/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}
export function adminDeleteCategory(id: number) {
  return request<{ ok: true }>(`/admin/categories/${id}`, { method: 'DELETE' });
}

export function adminGetTags(): Promise<TagRow[]> { return request('/admin/tags'); }
export function adminCreateTag(payload: { name: string; slug?: string }) {
  return request<TagRow>('/admin/tags', { method: 'POST', body: JSON.stringify(payload) });
}
export function adminUpdateTag(id: number, payload: Partial<TagRow>) {
  return request<{ id: number }>(`/admin/tags/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}
export function adminDeleteTag(id: number) {
  return request<{ ok: true }>(`/admin/tags/${id}`, { method: 'DELETE' });
}

export function adminGetSettings(): Promise<Record<string, string>> { return request('/admin/settings'); }
export function adminPutSettings(payload: Record<string, string>) {
  return request<Record<string, string>>('/admin/settings', { method: 'PUT', body: JSON.stringify(payload) });
}

export function uploadFile(file: File): Promise<{ url: string; key: string }> {
  const form = new FormData();
  form.append('file', file);
  return request('/admin/upload', { method: 'POST', body: form });
}
```

- [ ] **Step 7: 提交**

```bash
git add admin/src/main.ts admin/src/App.vue admin/src/router admin/src/api
git commit -m "feat: 后台路由（登录守卫）与 API 客户端"
```

---

# M5 前台页面（Astro）

### Task 28: 首页文章列表

**Files:**
- Create: `site/src/components/PostList.astro`
- Modify: `site/src/pages/index.astro`（覆盖 Task 24 占位）

- [ ] **Step 1: 创建 `site/src/components/PostList.astro`（服务端渲染的文章列表）**

```astro
---
interface PostRow {
  title: string;
  slug: string;
  summary: string;
  createdAt: number;
  viewCount: number;
}
interface Props {
  posts: PostRow[];
}
const { posts } = Astro.props;
---
{
  posts.length > 0 ? (
    <div class="post-list">
      {posts.map((post) => (
        <article class="post-card">
          <h2 class="post-title">
            <a href={`/post/${post.slug}`}>{post.title}</a>
          </h2>
          {post.summary && <p class="post-summary">{post.summary}</p>}
          <div class="post-meta">
            <span>{new Date(post.createdAt).toLocaleDateString('zh-CN')}</span>
            <span>👁 {post.viewCount}</span>
          </div>
        </article>
      ))}
    </div>
  ) : (
    <p class="post-empty">暂无文章</p>
  )
}
```

> 样式沿用 BaseLayout 中 `.post-card` / `.post-summary` / `.post-meta` 的全局定义，无需额外 CSS。

- [ ] **Step 2: 覆盖 `site/src/pages/index.astro`（首页 + 服务端分页）**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import PostList from '../components/PostList.astro';
import { getPosts } from '../lib/api';

const pageSize = 10;
const page = Math.max(1, Number(Astro.url.searchParams.get('page') ?? 1));
const data = await getPosts({ page });
const total = data.total;
const totalPages = Math.max(1, Math.ceil(total / pageSize));
---
<BaseLayout description="我的个人博客">
  <PostList posts={data.list} />
  {totalPages > 1 && (
    <nav class="pagination">
      {page > 1 && <a href={`/?page=${page - 1}`}>← 上一页</a>}
      <span class="page-info">{page} / {totalPages}</span>
      {page < totalPages && <a href={`/?page=${page + 1}`}>下一页 →</a>}
    </nav>
  )}
</BaseLayout>

<style is:global>
  .pagination {
    display: flex; gap: 16px; align-items: center; justify-content: center;
    padding: 24px 0; max-width: var(--max-width); margin: 0 auto;
  }
  .pagination a { color: var(--color-text); text-decoration: none; border: 1px solid var(--color-border); border-radius: var(--radius); padding: 6px 14px; background: var(--color-surface); }
  .pagination a:hover { color: var(--color-primary); border-color: var(--color-primary); }
  .page-info { color: var(--color-text-muted); font-size: 14px; }
</style>
```

- [ ] **Step 3: 手动验证**

Run: 终端1 `cd backend && npm run dev`；终端2 `cd site && npm run dev`
Expected: 打开 `http://localhost:4321` 首页展示文章列表；文章多于一页时可翻页（`?page=2`）。

- [ ] **Step 4: 提交**

```bash
git add site/src/components/PostList.astro site/src/pages/index.astro
git commit -m "feat: 首页文章列表（服务端渲染 + 分页）"
```

### Task 29: 文章详情页

**Files:**
- Create: `site/src/pages/post/[slug].astro`

- [ ] **Step 1: 创建 `site/src/pages/post/[slug].astro`**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import CommentSection from '../../components/CommentSection.vue';
import { getPost } from '../../lib/api';

const { slug } = Astro.params;
let post;
try {
  post = await getPost(slug!);
} catch {
  return Astro.redirect('/404');
}
---
<BaseLayout title={post.title} description={post.summary}>
  <div class="post-detail">
    <header class="post-head">
      <h1>{post.title}</h1>
      <div class="post-meta">
        {post.category && <a href={`/category/${post.category.slug}`}>{post.category.name}</a>}
        <span>{new Date(post.createdAt).toLocaleDateString('zh-CN')}</span>
        <span>👁 {post.viewCount}</span>
      </div>
      {post.tags.length > 0 && (
        <div class="post-tags">
          {post.tags.map((t) => <a class="tag" href={`/tag/${t.slug}`}>#{t.name}</a>)}
        </div>
      )}
    </header>
    {/* 后端已渲染并防 XSS 的 HTML */}
    <article class="markdown-body" set:html={post.contentHtml} />
    <CommentSection client:load postId={post.id} />
  </div>
</BaseLayout>

<style is:global>
  .post-detail { max-width: var(--max-width); margin: 0 auto; }
  .post-head { margin-bottom: 24px; }
  .post-head h1 { font-size: 28px; margin: 0 0 12px; }
  .post-tags { margin-top: 12px; display: flex; gap: 8px; }
  .post-tags .tag { color: var(--color-primary); font-size: 13px; text-decoration: none; }
</style>
```

- [ ] **Step 2: 手动验证**

Run: 打开 `http://localhost:4321/post/<slug>`
Expected: 标题/分类/标签/正文渲染、代码高亮、评论 island 加载。

> 注：`CommentSection.vue` 在 Task 31 创建；本任务先创建页面，构建时若引用了不存在的组件会失败——把 `<CommentSection .../>` 暂时注释，Task 31 再打开；或直接一并等到 Task 31 验证。实施时二选一，保持构建通过。

- [ ] **Step 3: 提交**

```bash
git add site/src/pages/post
git commit -m "feat: 文章详情页（SSR + 阅读模式按钮在 header）"
```

### Task 30: 分类 / 标签 / 搜索 / 归档页

**Files:**
- Create: `site/src/pages/category/[slug].astro`
- Create: `site/src/pages/tag/[slug].astro`
- Create: `site/src/pages/search.astro`
- Create: `site/src/pages/archive.astro`

- [ ] **Step 1: 创建 `site/src/pages/category/[slug].astro`**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import PostList from '../../components/PostList.astro';
import { getPosts, getCategories } from '../../lib/api';

const { slug } = Astro.params;
const [data, categories] = await Promise.all([getPosts({ category: slug }), getCategories()]);
const name = categories.find((c) => c.slug === slug)?.name ?? String(slug);
---
<BaseLayout title={`分类：${name}`}>
  <h1 class="page-title">分类：{name}</h1>
  <PostList posts={data.list} />
</BaseLayout>

<style is:global>
  .page-title { font-size: 22px; margin-bottom: 20px; max-width: var(--max-width); margin-left: auto; margin-right: auto; }
</style>
```

- [ ] **Step 2: 创建 `site/src/pages/tag/[slug].astro`**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import PostList from '../../components/PostList.astro';
import { getPosts, getTags } from '../../lib/api';

const { slug } = Astro.params;
const [data, tags] = await Promise.all([getPosts({ tag: slug }), getTags()]);
const name = tags.find((t) => t.slug === slug)?.name ?? String(slug);
---
<BaseLayout title={`标签：${name}`}>
  <h1 class="page-title">标签：# {name}</h1>
  <PostList posts={data.list} />
</BaseLayout>

<style is:global>
  .page-title { font-size: 22px; margin-bottom: 20px; max-width: var(--max-width); margin-left: auto; margin-right: auto; }
</style>
```

- [ ] **Step 3: 创建 `site/src/pages/search.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import PostList from '../components/PostList.astro';
import { getPosts } from '../lib/api';

const q = Astro.url.searchParams.get('q')?.trim() ?? '';
const results = q ? await getPosts({ q }) : null;
---
<BaseLayout title={q ? `搜索：${q}` : '搜索'}>
  <form class="search-form" action="/search" method="get">
    <input name="q" value={q} placeholder="搜索文章标题或正文…" />
    <button type="submit">搜索</button>
  </form>
  {results && (
    <>
      <p class="result-info">共找到 {results.total} 篇相关文章</p>
      <PostList posts={results.list} />
    </>
  )}
</BaseLayout>

<style is:global>
  .search-form {
    display: flex; gap: 8px; max-width: var(--max-width); margin: 0 auto 20px;
  }
  .search-form input {
    flex: 1; border: 1px solid var(--color-border); border-radius: var(--radius);
    padding: 8px 12px; background: var(--color-surface); color: var(--color-text);
  }
  .search-form button {
    border: none; background: var(--color-primary); color: var(--color-primary-contrast);
    border-radius: var(--radius); padding: 8px 16px; cursor: pointer;
  }
  .result-info { color: var(--color-text-muted); font-size: 14px; margin: 0 0 16px; max-width: var(--max-width); margin-left: auto; margin-right: auto; }
</style>
```

- [ ] **Step 4: 创建 `site/src/pages/archive.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { getArchive } from '../lib/api';

const groups = await getArchive();
---
<BaseLayout title="归档">
  <h1 class="page-title">归档</h1>
  {groups.map((g) => (
    <section class="archive-group">
      <h2 class="month">{g.month}</h2>
      <ul>
        {g.items.map((item) => (
          <li>
            <span class="date">{new Date(item.createdAt).toLocaleDateString('zh-CN')}</span>
            <a href={`/post/${item.slug}`}>{item.title}</a>
          </li>
        ))}
      </ul>
    </section>
  ))}
</BaseLayout>

<style is:global>
  .archive-group { margin-bottom: 24px; max-width: var(--max-width); margin-left: auto; margin-right: auto; }
  .month { font-size: 16px; color: var(--color-primary); border-bottom: 1px solid var(--color-border); padding-bottom: 6px; }
  .archive-group ul { list-style: none; padding: 0; }
  .archive-group li { padding: 6px 0; display: flex; gap: 12px; }
  .date { color: var(--color-text-muted); font-size: 13px; min-width: 90px; }
  .archive-group a { color: var(--color-text); text-decoration: none; }
  .archive-group a:hover { color: var(--color-primary); }
</style>
```

- [ ] **Step 5: 提交**

```bash
git add site/src/pages/category site/src/pages/tag site/src/pages/search.astro site/src/pages/archive.astro
git commit -m "feat: 分类/标签/搜索/归档页"
```

### Task 31: 评论组件（Vue island，含回复树）

**Files:**
- Create: `site/src/components/CommentSection.vue`
- Modify: `site/src/pages/post/[slug].astro`（确认 CommentSection 引用已打开）

- [ ] **Step 1: 创建 `site/src/components/CommentSection.vue`**

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

const props = defineProps<{ postId: number }>();

interface CommentItem {
  id: number;
  author: string;
  content: string;
  createdAt: number;
  parentId: number | null;
}

const list = ref<CommentItem[]>([]);
const author = ref('');
const email = ref('');
const content = ref('');
const submitting = ref(false);
const message = ref('');
const loaded = ref(false);
const replyTo = ref<{ id: number; author: string } | null>(null);
const replyContent = ref('');

// 顶层评论 + 挂在其下的子评论（回复树，一层缩进）
const threads = computed(() => {
  const top = list.value.filter((c) => c.parentId === null);
  return top.map((c) => ({
    ...c,
    replies: list.value.filter((r) => r.parentId === c.id),
  }));
});

async function load() {
  const res = await fetch(`/api/comments?post_id=${props.postId}`);
  const body = await res.json();
  list.value = body.data;
  loaded.value = true;
}

async function submit() {
  if (!author.value.trim() || !content.value.trim()) {
    message.value = '请填写昵称和内容';
    return;
  }
  submitting.value = true;
  try {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: props.postId, author: author.value, email: email.value, content: content.value }),
    });
    const body = await res.json();
    if (!res.ok) {
      message.value = body?.error?.message ?? '提交失败';
    } else {
      message.value = '评论已提交，等待审核';
      author.value = '';
      email.value = '';
      content.value = '';
    }
  } finally {
    submitting.value = false;
  }
}

async function submitReply(parentId: number) {
  if (!replyContent.value.trim()) {
    message.value = '回复内容不能为空';
    return;
  }
  submitting.value = true;
  try {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: props.postId, author: author.value || '访客', email: email.value, content: replyContent.value, parentId }),
    });
    const body = await res.json();
    message.value = res.ok ? '回复已提交，等待审核' : (body?.error?.message ?? '提交失败');
    if (res.ok) {
      replyTo.value = null;
      replyContent.value = '';
    }
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="comment-section">
    <h2 class="comment-title">评论</h2>

    <ul v-if="loaded && threads.length" class="comment-list">
      <li v-for="c in threads" :key="c.id" class="comment-item">
        <div class="comment-head">
          <strong>{{ c.author }}</strong>
          <span class="comment-date">{{ new Date(c.createdAt).toLocaleDateString('zh-CN') }}</span>
          <button class="reply-btn" type="button" @click="replyTo = { id: c.id, author: c.author }">回复</button>
        </div>
        <p class="comment-content">{{ c.content }}</p>
        <ul v-if="c.replies.length" class="reply-list">
          <li v-for="r in c.replies" :key="r.id" class="reply-item">
            <div class="comment-head">
              <strong>{{ r.author }}</strong>
              <span class="comment-date">{{ new Date(r.createdAt).toLocaleDateString('zh-CN') }}</span>
            </div>
            <p class="comment-content">{{ r.content }}</p>
          </li>
        </ul>
        <form v-if="replyTo?.id === c.id" class="reply-form" @submit.prevent="submitReply(c.id)">
          <textarea v-model="replyContent" :placeholder="`回复 @${replyTo.author}`" maxlength="2000" rows="2" />
          <div class="reply-actions">
            <button type="button" class="cancel-btn" @click="replyTo = null; replyContent = ''">取消</button>
            <button type="submit" :disabled="submitting">回复</button>
          </div>
        </form>
      </li>
    </ul>
    <p v-else-if="loaded" class="comment-empty">还没有评论，来抢沙发~</p>
    <p v-else class="comment-empty">评论加载中…</p>

    <form class="comment-form" @submit.prevent="submit">
      <div class="row">
        <input v-model="author" placeholder="昵称 *" maxlength="50" />
        <input v-model="email" type="email" placeholder="邮箱（不会公开）" maxlength="100" />
      </div>
      <textarea v-model="content" placeholder="说点什么… *" maxlength="2000" rows="4" />
      <div class="row end">
        <p v-if="message" class="comment-message">{{ message }}</p>
        <button type="submit" :disabled="submitting">{{ submitting ? '提交中…' : '发表评论' }}</button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.comment-section { margin-top: 48px; border-top: 1px solid var(--color-border); padding-top: 24px; }
.comment-title { font-size: 18px; margin-bottom: 16px; }
.comment-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 14px; }
.comment-item { border-bottom: 1px dashed var(--color-border); padding-bottom: 12px; }
.comment-head { display: flex; gap: 12px; align-items: center; margin-bottom: 4px; }
.comment-head strong { color: var(--color-primary); }
.comment-date { color: var(--color-text-muted); font-size: 12px; }
.comment-content { margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
.reply-btn, .cancel-btn { background: none; border: none; color: var(--color-text-muted); font-size: 12px; cursor: pointer; padding: 0; }
.reply-btn:hover, .cancel-btn:hover { color: var(--color-primary); }
.reply-list { list-style: none; margin: 10px 0 0 16px; padding-left: 12px; border-left: 2px solid var(--color-border); display: flex; flex-direction: column; gap: 10px; }
.reply-item { background: var(--color-code-bg); border-radius: var(--radius); padding: 10px 12px; }
.reply-form { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
.reply-form textarea { border: 1px solid var(--color-border); border-radius: var(--radius); padding: 8px 12px; background: var(--color-surface); color: var(--color-text); resize: vertical; }
.reply-actions { display: flex; justify-content: flex-end; gap: 8px; }
.reply-actions button, .comment-form button { border: none; background: var(--color-primary); color: var(--color-primary-contrast); border-radius: var(--radius); padding: 6px 14px; cursor: pointer; }
.comment-empty { color: var(--color-text-muted); font-size: 14px; padding: 16px 0; }
.comment-form { margin-top: 20px; display: flex; flex-direction: column; gap: 10px; }
.row { display: flex; gap: 10px; }
.row.end { justify-content: flex-end; align-items: center; }
.comment-form input, .comment-form textarea {
  border: 1px solid var(--color-border); border-radius: var(--radius);
  padding: 8px 12px; background: var(--color-surface); color: var(--color-text); font-family: inherit;
}
.comment-form input { flex: 1; }
.comment-form textarea { resize: vertical; }
.comment-form button:disabled { opacity: 0.6; cursor: not-allowed; }
.comment-message { color: var(--color-text-muted); font-size: 13px; }
</style>
```

- [ ] **Step 2: 更新 `site/src/pages/post/[slug].astro`**

确认 `import CommentSection from '../../components/CommentSection.vue';` 与 `<CommentSection client:load postId={post.id} />` 存在（若 Task 29 时注释了，现在打开）。

- [ ] **Step 3: 手动验证**

Run: 打开 `http://localhost:4321/post/<slug>`，滚动到底部
Expected: 评论列表、发表评论（提示"等待审核"）、点"回复"出现回复表单。

- [ ] **Step 4: 提交**

```bash
git add site/src/components/CommentSection.vue site/src/pages/post
git commit -m "feat: 评论组件（Vue island，回复树）"
```

### Task 32: 友链页

**Files:**
- Create: `site/src/pages/friends.astro`
- Create: `site/src/components/FriendLinkForm.vue`

- [ ] **Step 1: 创建 `site/src/pages/friends.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import FriendLinkForm from '../components/FriendLinkForm.vue';
import { getFriendLinks } from '../lib/api';

const links = await getFriendLinks();
---
<BaseLayout title="友情链接">
  <h1 class="page-title">友情链接</h1>
  {links.length > 0 ? (
    <div class="link-grid">
      {links.map((l) => (
        <a class="link-card" href={l.url} target="_blank" rel="noopener">
          <div class="link-avatar">{l.name.slice(0, 1)}</div>
          <div>
            <div class="link-name">{l.name}</div>
            {l.description && <div class="link-desc">{l.description}</div>}
          </div>
        </a>
      ))}
    </div>
  ) : (
    <p class="link-empty">暂无友链</p>
  )}
  <FriendLinkForm client:load />
</BaseLayout>

<style is:global>
  .page-title { font-size: 22px; margin-bottom: 20px; max-width: var(--max-width); margin-left: auto; margin-right: auto; }
  .link-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px;
    max-width: var(--max-width); margin: 0 auto;
  }
  .link-card {
    display: flex; gap: 12px; align-items: center; padding: 14px;
    background: var(--color-surface); border: 1px solid var(--color-border);
    border-radius: var(--radius); box-shadow: var(--shadow); text-decoration: none; color: var(--color-text);
  }
  .link-card:hover { border-color: var(--color-primary); }
  .link-avatar {
    width: 40px; height: 40px; border-radius: 50%; background: var(--color-primary);
    color: var(--color-primary-contrast); display: flex; align-items: center; justify-content: center; font-weight: 700;
  }
  .link-name { font-weight: 600; }
  .link-desc { color: var(--color-text-muted); font-size: 13px; margin-top: 2px; }
  .link-empty { color: var(--color-text-muted); padding: 24px 0; text-align: center; }
</style>
```

- [ ] **Step 2: 创建 `site/src/components/FriendLinkForm.vue`（Vue island）**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';

const enabled = ref(true);
const form = ref({ name: '', url: '', description: '' });
const message = ref('');
const submitting = ref(false);

onMounted(async () => {
  const res = await fetch('/api/settings/public');
  const body = await res.json();
  enabled.value = body.data.friendLinkEnabled;
});

async function submit() {
  submitting.value = true;
  message.value = '';
  try {
    const res = await fetch('/api/friend-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value),
    });
    const body = await res.json();
    if (!res.ok) message.value = body?.error?.message ?? '提交失败';
    else {
      message.value = '申请已提交，等待站长审核';
      form.value = { name: '', url: '', description: '' };
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <form v-if="enabled" class="link-form" @submit.prevent="submit">
    <h2>申请友链</h2>
    <input v-model="form.name" placeholder="站点名称 *" maxlength="50" />
    <input v-model="form.url" placeholder="站点网址（https://…） *" maxlength="300" />
    <input v-model="form.description" placeholder="一句话简介" maxlength="200" />
    <div class="row end">
      <p v-if="message" class="link-message">{{ message }}</p>
      <button type="submit" :disabled="submitting">{{ submitting ? '提交中…' : '提交申请' }}</button>
    </div>
  </form>
  <p v-else class="link-form-disabled">友链申请已关闭</p>
</template>

<style scoped>
.link-form { margin: 32px auto 0; display: flex; flex-direction: column; gap: 10px; max-width: 480px; }
.link-form h2 { font-size: 16px; margin: 0 0 4px; }
.link-form input {
  border: 1px solid var(--color-border); border-radius: var(--radius);
  padding: 8px 12px; background: var(--color-surface); color: var(--color-text);
}
.row.end { display: flex; justify-content: flex-end; align-items: center; gap: 12px; }
.link-form button {
  border: none; background: var(--color-primary); color: var(--color-primary-contrast);
  border-radius: var(--radius); padding: 8px 18px; cursor: pointer;
}
.link-form button:disabled { opacity: 0.6; }
.link-message { color: var(--color-text-muted); font-size: 13px; }
.link-form-disabled { color: var(--color-text-muted); text-align: center; padding: 24px 0; }
</style>
```

- [ ] **Step 3: 提交**

```bash
git add site/src/pages/friends.astro site/src/components/FriendLinkForm.vue
git commit -m "feat: 友链页（列表 + 申请表单 island）"
```

### Task 33: 前台验收

**Files:**
- Create: `site/src/pages/404.astro`

- [ ] **Step 1: 创建 `site/src/pages/404.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---
<BaseLayout title="页面不存在">
  <div class="not-found">
    <h1>404</h1>
    <p>页面不存在或已下线</p>
    <a href="/">返回首页</a>
  </div>
</BaseLayout>

<style is:global>
  .not-found { text-align: center; padding: 80px 0; }
  .not-found h1 { font-size: 48px; margin: 0 0 12px; }
  .not-found p { color: var(--color-text-muted); }
</style>
```

- [ ] **Step 2: 类型检查与构建**

Run: `cd site && npm run check && npm run build`
Expected: 通过；`dist/server/entry.mjs` 生成。

- [ ] **Step 3: 全站手动验收（两个终端：backend + site）**

1. 首页列表与分页；文章详情（正文/高亮/评论/回复）
2. 分类页、标签页、搜索（`/search?q=关键词`）、归档页
3. 主题切换按钮（导航栏）→ 阅读模式（Lenis 停止，原生滚动）
4. RSS：`http://localhost:4321/api/rss`（经 Vite proxy 转发到后端）
5. 404 页（访问不存在的 URL）
6. 友链页：列表 + 申请表单（提交后提示待审核）

- [ ] **Step 4: 提交（如有修复）**

```bash
git add -A
git commit -m "fix: 前台验收问题修复"
```

---

# M6 后台页面（Vue SPA）

### Task 34: 登录页与后台布局

**Files:**
- Create: `admin/src/views/Login.vue`
- Create: `admin/src/views/AdminLayout.vue`

- [ ] **Step 1: 创建 `admin/src/views/Login.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { login } from '../api/admin';

const router = useRouter();
const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  loading.value = true;
  error.value = '';
  try {
    const res = await login(username.value, password.value);
    localStorage.setItem('admin_token', res.token);
    router.push('/admin/');
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <form class="login-card" @submit.prevent="submit">
      <h1>MBLOG 管理后台</h1>
      <input v-model="username" placeholder="用户名" autocomplete="username" />
      <input v-model="password" type="password" placeholder="密码" autocomplete="current-password" />
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="loading">{{ loading ? '登录中…' : '登录' }}</button>
    </form>
  </div>
</template>

<style scoped>
.login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f5f6f8; }
.login-card { width: 320px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); padding: 32px 24px; display: flex; flex-direction: column; gap: 12px; }
.login-card h1 { font-size: 20px; margin: 0 0 8px; text-align: center; }
.login-card input { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; }
.login-card button { border: none; background: #3b82f6; color: #fff; border-radius: 8px; padding: 10px; cursor: pointer; font-size: 15px; }
.login-card button:disabled { opacity: 0.6; }
.error { color: #dc2626; font-size: 13px; margin: 0; }
</style>
```

- [ ] **Step 2: 创建 `admin/src/views/AdminLayout.vue`**

```vue
<script setup lang="ts">
import { useRouter } from 'vue-router';
import { logout } from '../api/admin';

const router = useRouter();
function doLogout() {
  logout();
  router.push('/admin/login');
}
</script>

<template>
  <div class="admin-layout">
    <aside class="admin-side">
      <div class="admin-brand">MBLOG 后台</div>
      <nav>
        <router-link to="/admin/">仪表盘</router-link>
        <router-link to="/admin/posts">文章</router-link>
        <router-link to="/admin/categories">分类</router-link>
        <router-link to="/admin/tags">标签</router-link>
        <router-link to="/admin/comments">评论</router-link>
        <router-link to="/admin/friends">友链</router-link>
        <router-link to="/admin/settings">设置</router-link>
      </nav>
      <div class="admin-actions">
        <a href="/">← 查看站点</a>
        <button type="button" @click="doLogout">退出登录</button>
      </div>
    </aside>
    <main class="admin-main"><slot /></main>
  </div>
</template>

<style scoped>
.admin-layout { display: flex; min-height: 100vh; background: #f5f6f8; }
.admin-side { width: 200px; background: #1f2937; color: #e5e7eb; display: flex; flex-direction: column; padding: 16px 0; position: sticky; top: 0; height: 100vh; }
.admin-brand { padding: 0 20px 16px; font-weight: 700; font-size: 16px; border-bottom: 1px solid #374151; }
.admin-side nav { display: flex; flex-direction: column; padding: 12px 0; }
.admin-side nav a { color: #d1d5db; text-decoration: none; padding: 10px 20px; font-size: 14px; }
.admin-side nav a.router-link-active, .admin-side nav a:hover { background: #374151; color: #fff; }
.admin-actions { margin-top: auto; padding: 12px 20px; display: flex; flex-direction: column; gap: 10px; border-top: 1px solid #374151; }
.admin-actions a { color: #d1d5db; font-size: 13px; text-decoration: none; }
.admin-actions button { background: none; border: 1px solid #4b5563; color: #e5e7eb; border-radius: 6px; padding: 6px; cursor: pointer; font-size: 13px; }
.admin-main { flex: 1; padding: 24px; max-width: 1100px; }
</style>
```

- [ ] **Step 3: 手动验证**

Run: 终端1 `cd backend && npm run dev`；终端2 `cd admin && npm run dev`
Expected: 打开 `http://localhost:5173/admin/login`（admin dev server 上 base=/admin/），用 admin/admin123 登录跳转 `/admin/`；未登录访问 `/admin/` 自动跳登录页。

- [ ] **Step 4: 提交**

```bash
git add admin/src/views/Login.vue admin/src/views/AdminLayout.vue
git commit -m "feat: 后台登录页与布局"
```

### Task 35: 仪表盘

**Files:**
- Create: `admin/src/views/Dashboard.vue`

- [ ] **Step 1: 创建 `admin/src/views/Dashboard.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getStats } from '../api/admin';

const stats = ref<Awaited<ReturnType<typeof getStats>> | null>(null);

onMounted(async () => {
  stats.value = await getStats();
});
</script>

<template>
  <div>
    <h1 class="page-title">仪表盘</h1>
    <div v-if="stats" class="stat-grid">
      <div class="stat-card"><div class="num">{{ stats.postTotal }}</div><div class="label">文章总数</div></div>
      <div class="stat-card"><div class="num">{{ stats.published }}</div><div class="label">已发布</div></div>
      <div class="stat-card"><div class="num">{{ stats.commentTotal }}</div><div class="label">评论总数</div></div>
      <div class="stat-card warn"><div class="num">{{ stats.pendingComments }}</div><div class="label">待审核评论</div></div>
      <div class="stat-card"><div class="num">{{ stats.totalViews }}</div><div class="label">总阅读量</div></div>
    </div>
    <p v-else class="loading">加载中…</p>
  </div>
</template>

<style scoped>
.page-title { font-size: 22px; margin-bottom: 20px; }
.stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 14px; }
.stat-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; text-align: center; }
.stat-card .num { font-size: 28px; font-weight: 700; }
.stat-card.warn .num { color: #d97706; }
.stat-card .label { color: #6b7280; font-size: 13px; margin-top: 4px; }
.loading { color: #6b7280; }
</style>
```

- [ ] **Step 2: 提交**

```bash
git add admin/src/views/Dashboard.vue
git commit -m "feat: 后台仪表盘"
```

### Task 36: 文章列表与 Markdown 编辑器

**Files:**
- Create: `admin/src/views/PostList.vue`
- Create: `admin/src/views/PostEditor.vue`

- [ ] **Step 1: 创建 `admin/src/views/PostList.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { adminGetPosts, adminDeletePost, type AdminPostRow } from '../api/admin';

const router = useRouter();
const posts = ref<AdminPostRow[]>([]);
const statusFilter = ref('');
const total = ref(0);

async function load() {
  const data = await adminGetPosts({ status: statusFilter.value || undefined });
  posts.value = data.list;
  total.value = data.total;
}
async function remove(id: number) {
  if (!confirm('确定删除该文章？此操作不可恢复。')) return;
  await adminDeletePost(id);
  load();
}
onMounted(load);
</script>

<template>
  <div>
    <div class="toolbar">
      <h1 class="page-title">文章管理</h1>
      <button class="btn primary" @click="router.push('/admin/posts/new')">＋ 新建文章</button>
    </div>
    <select v-model="statusFilter" class="filter" @change="load">
      <option value="">全部状态</option>
      <option value="published">已发布</option>
      <option value="draft">草稿</option>
    </select>
    <table class="table">
      <thead>
        <tr><th>标题</th><th>状态</th><th>更新时间</th><th>阅读量</th><th>操作</th></tr>
      </thead>
      <tbody>
        <tr v-for="p in posts" :key="p.id">
          <td><router-link :to="`/admin/posts/${p.id}`">{{ p.title }}</router-link></td>
          <td><span class="badge" :class="p.status">{{ p.status === 'published' ? '已发布' : '草稿' }}</span></td>
          <td>{{ new Date(p.updatedAt).toLocaleDateString('zh-CN') }}</td>
          <td>{{ p.viewCount }}</td>
          <td>
            <button class="link-btn" @click="router.push(`/admin/posts/${p.id}`)">编辑</button>
            <button class="link-btn danger" @click="remove(p.id)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="!posts.length" class="empty">暂无文章</p>
  </div>
</template>

<style scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-title { font-size: 22px; margin: 0; }
.btn { border: none; border-radius: 8px; padding: 8px 16px; cursor: pointer; }
.btn.primary { background: #3b82f6; color: #fff; }
.filter { margin-bottom: 16px; padding: 6px 10px; border: 1px solid #e5e7eb; border-radius: 8px; }
.table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 10px; overflow: hidden; }
.table th, .table td { padding: 12px 14px; text-align: left; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
.table th { background: #f9fafb; color: #6b7280; font-weight: 600; }
.badge { padding: 2px 10px; border-radius: 999px; font-size: 12px; }
.badge.published { background: #ecfdf5; color: #059669; }
.badge.draft { background: #fef3c7; color: #b45309; }
.link-btn { background: none; border: none; color: #3b82f6; cursor: pointer; font-size: 14px; margin-right: 8px; }
.link-btn.danger { color: #dc2626; }
.empty { color: #6b7280; text-align: center; padding: 32px 0; }
</style>
```

- [ ] **Step 2: 创建 `admin/src/views/PostEditor.vue`（Vditor + 图片/音频上传）**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import {
  adminGetPost, adminCreatePost, adminUpdatePost,
  adminGetCategories, adminGetTags, uploadFile,
} from '../api/admin';

const route = useRoute();
const router = useRouter();
const editId = Number(route.params.id ?? 0);

const form = ref({
  title: '',
  slug: '',
  summary: '',
  cover: '',
  categoryId: 0,
  status: 'draft' as 'draft' | 'published',
  contentMd: '',
  tagIds: [] as number[],
});
const categories = ref<Awaited<ReturnType<typeof adminGetCategories>>>([]);
const tags = ref<Awaited<ReturnType<typeof adminGetTags>>>([]);
const saving = ref(false);
const error = ref('');

let vditor: Vditor | null = null;

function buildToolbar() {
  const audioButton = {
    name: 'insertAudio',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.4 5.6a9 9 0 0 1 0 12.8"/></svg>',
    tip: '插入音频',
    click: () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file || !vditor) return;
        const { url } = await uploadFile(file);
        vditor.insertValue(`<audio controls src="${url}"></audio>\n`, true);
      };
      input.click();
    },
  };
  return [
    'headings', 'bold', 'italic', 'strike', 'link', '|',
    'list', 'ordered-list', 'check', 'outdent', 'indent', '|',
    'quote', 'line', 'code', 'inline-code', 'table', '|',
    'upload', audioButton, '|', 'undo', 'redo', '|', 'fullscreen',
  ];
}

onMounted(async () => {
  categories.value = await adminGetCategories();
  tags.value = await adminGetTags();

  if (editId) {
    const post = await adminGetPost(editId);
    form.value = {
      title: post.title,
      slug: post.slug,
      summary: post.summary,
      cover: post.cover,
      categoryId: post.categoryId ?? 0,
      status: post.status,
      contentMd: post.contentMd,
      tagIds: post.tags.map((t) => t.id),
    };
  }

  vditor = new Vditor('vditor', {
    height: 480,
    mode: 'wysiwyg',
    toolbar: buildToolbar(),
    cache: { enable: false },
    upload: {
      url: '/api/admin/upload',
      fieldName: 'file',
      headers: { Authorization: `Bearer ${localStorage.getItem('admin_token') ?? ''}` },
      fileVal: 'file',
      filename: 'file',
      accept: 'image/*',
    },
    input: (value: string) => {
      form.value.contentMd = value;
    },
    after: () => {
      if (vditor) vditor.setValue(form.value.contentMd);
    },
  });
});

async function save(status: 'draft' | 'published') {
  saving.value = true;
  error.value = '';
  const contentMd = vditor ? vditor.getValue() : form.value.contentMd;
  const payload = {
    title: form.value.title,
    slug: form.value.slug || undefined,
    contentMd,
    summary: form.value.summary,
    cover: form.value.cover,
    categoryId: form.value.categoryId || null,
    status,
    tagIds: form.value.tagIds,
  };
  try {
    if (editId) await adminUpdatePost(editId, payload);
    else await adminCreatePost(payload);
    router.push('/admin/posts');
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <div class="editor-head">
      <h1 class="page-title">{{ editId ? '编辑文章' : '新建文章' }}</h1>
      <div class="actions">
        <button class="btn" @click="save('draft')">存草稿</button>
        <button class="btn primary" :disabled="saving" @click="save('published')">{{ saving ? '保存中…' : '发布' }}</button>
      </div>
    </div>
    <p v-if="error" class="error">{{ error }}</p>

    <div class="form-grid">
      <div class="form-main">
        <input v-model="form.title" class="title-input" placeholder="文章标题 *" />
        <input v-model="form.slug" class="slug-input" placeholder="slug（留空自动生成）" />
        <textarea v-model="form.summary" class="summary-input" placeholder="摘要（留空自动截取正文）" rows="2" />
        <div id="vditor" />
      </div>
      <aside class="form-side">
        <label>分类
          <select v-model.number="form.categoryId">
            <option :value="0">无</option>
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>
        <label>标签
          <div class="tag-check">
            <label v-for="t in tags" :key="t.id" class="tag-item">
              <input v-model="form.tagIds" type="checkbox" :value="t.id" /> {{ t.name }}
            </label>
          </div>
        </label>
        <label>封面图 URL
          <input v-model="form.cover" placeholder="https://…" />
        </label>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.editor-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-title { font-size: 22px; margin: 0; }
.actions { display: flex; gap: 10px; }
.btn { border: 1px solid #e5e7eb; background: #fff; border-radius: 8px; padding: 8px 16px; cursor: pointer; }
.btn.primary { background: #3b82f6; color: #fff; border-color: #3b82f6; }
.btn:disabled { opacity: 0.6; }
.error { color: #dc2626; }
.form-grid { display: grid; grid-template-columns: 1fr 260px; gap: 20px; align-items: start; }
.form-main { display: flex; flex-direction: column; gap: 10px; }
.title-input { font-size: 20px; font-weight: 600; padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 8px; }
.slug-input, .summary-input, .form-side input, .form-side select {
  padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 8px; width: 100%; box-sizing: border-box;
}
.form-side { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
.form-side label { font-size: 13px; color: #6b7280; display: flex; flex-direction: column; gap: 6px; }
.tag-check { display: flex; flex-direction: column; gap: 6px; }
.tag-item { font-size: 14px; color: #1f2937; flex-direction: row; align-items: center; }
</style>
```

> 说明：Vditor 上传配置中 `fieldName`/`fileVal`/`filename` 指向同一字段 `file`，与后端 `body.file` 对应。若实测上传 400，检查字段名一致性。

- [ ] **Step 3: 手动验证**

Run: `/admin/posts/new` 打开编辑器，测试：输入标题与 Markdown、上传图片、点"♪ 插入音频"上传音频、存草稿、发布、再编辑回显。

- [ ] **Step 4: 提交**

```bash
git add admin/src/views/PostList.vue admin/src/views/PostEditor.vue
git commit -m "feat: 后台文章列表与 Vditor 编辑器（图片/音频上传）"
```

### Task 37: 分类与标签管理页

**Files:**
- Create: `admin/src/views/CategoryManager.vue`
- Create: `admin/src/views/TagManager.vue`

- [ ] **Step 1: 创建 `admin/src/views/CategoryManager.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  adminGetCategories, adminCreateCategory, adminUpdateCategory, adminDeleteCategory,
  type CategoryRow,
} from '../api/admin';

const list = ref<CategoryRow[]>([]);
const name = ref('');
const editing = ref<CategoryRow | null>(null);

async function load() {
  list.value = await adminGetCategories();
}
async function add() {
  if (!name.value.trim()) return;
  await adminCreateCategory({ name: name.value });
  name.value = '';
  load();
}
async function update() {
  if (!editing.value) return;
  await adminUpdateCategory(editing.value.id, { name: editing.value.name });
  editing.value = null;
  load();
}
async function remove(id: number) {
  if (!confirm('删除该分类？文章不会删除，仅解除关联。')) return;
  await adminDeleteCategory(id);
  load();
}
onMounted(load);
</script>

<template>
  <div>
    <h1 class="page-title">分类管理</h1>
    <div class="add-row">
      <input v-model="name" placeholder="新分类名称" @keyup.enter="add" />
      <button class="btn primary" @click="add">添加</button>
    </div>
    <table class="table">
      <thead><tr><th>名称</th><th>slug</th><th>文章数</th><th>操作</th></tr></thead>
      <tbody>
        <tr v-for="c in list" :key="c.id">
          <td>
            <template v-if="editing?.id === c.id">
              <input v-model="editing.name" @keyup.enter="update" />
            </template>
            <template v-else>{{ c.name }}</template>
          </td>
          <td>{{ c.slug }}</td>
          <td>{{ c.postCount }}</td>
          <td>
            <button class="link-btn" @click="editing = { ...c }">编辑</button>
            <button v-if="editing?.id === c.id" class="link-btn" @click="update">保存</button>
            <button class="link-btn danger" @click="remove(c.id)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.page-title { font-size: 22px; margin-bottom: 20px; }
.add-row { display: flex; gap: 10px; margin-bottom: 16px; }
.add-row input { flex: 1; max-width: 320px; padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 8px; }
.btn { border: none; border-radius: 8px; padding: 8px 16px; cursor: pointer; }
.btn.primary { background: #3b82f6; color: #fff; }
.table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 10px; }
.table th, .table td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
.table th { background: #f9fafb; color: #6b7280; }
.table input { padding: 4px 8px; border: 1px solid #e5e7eb; border-radius: 6px; }
.link-btn { background: none; border: none; color: #3b82f6; cursor: pointer; margin-right: 8px; }
.link-btn.danger { color: #dc2626; }
</style>
```

- [ ] **Step 2: 创建 `admin/src/views/TagManager.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  adminGetTags, adminCreateTag, adminUpdateTag, adminDeleteTag, type TagRow,
} from '../api/admin';

const list = ref<TagRow[]>([]);
const name = ref('');
const editing = ref<TagRow | null>(null);

async function load() {
  list.value = await adminGetTags();
}
async function add() {
  if (!name.value.trim()) return;
  await adminCreateTag({ name: name.value });
  name.value = '';
  load();
}
async function update() {
  if (!editing.value) return;
  await adminUpdateTag(editing.value.id, { name: editing.value.name });
  editing.value = null;
  load();
}
async function remove(id: number) {
  await adminDeleteTag(id);
  load();
}
onMounted(load);
</script>

<template>
  <div>
    <h1 class="page-title">标签管理</h1>
    <div class="add-row">
      <input v-model="name" placeholder="新标签名称" @keyup.enter="add" />
      <button class="btn primary" @click="add">添加</button>
    </div>
    <div class="tag-list">
      <div v-for="t in list" :key="t.id" class="tag-chip">
        <template v-if="editing?.id === t.id">
          <input v-model="editing.name" @keyup.enter="update" />
          <button class="link-btn" @click="update">存</button>
        </template>
        <template v-else>
          <span>#{{ t.name }}（{{ t.postCount }}）</span>
          <button class="link-btn" @click="editing = { ...t }">编辑</button>
        </template>
        <button class="link-btn danger" @click="remove(t.id)">删除</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-title { font-size: 22px; margin-bottom: 20px; }
.add-row { display: flex; gap: 10px; margin-bottom: 16px; }
.add-row input { flex: 1; max-width: 320px; padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 8px; }
.btn { border: none; border-radius: 8px; padding: 8px 16px; cursor: pointer; }
.btn.primary { background: #3b82f6; color: #fff; }
.tag-list { display: flex; flex-wrap: wrap; gap: 10px; }
.tag-chip { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #e5e7eb; border-radius: 999px; padding: 6px 14px; font-size: 14px; }
.tag-chip input { width: 100px; padding: 4px 8px; border: 1px solid #e5e7eb; border-radius: 6px; }
.link-btn { background: none; border: none; color: #3b82f6; cursor: pointer; font-size: 13px; }
.link-btn.danger { color: #dc2626; }
</style>
```

- [ ] **Step 3: 提交**

```bash
git add admin/src/views/CategoryManager.vue admin/src/views/TagManager.vue
git commit -m "feat: 后台分类/标签管理"
```

### Task 38: 评论与友链管理页

**Files:**
- Create: `admin/src/views/CommentManager.vue`
- Create: `admin/src/views/FriendLinkManager.vue`

- [ ] **Step 1: 创建 `admin/src/views/CommentManager.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { adminGetComments, adminPatchComment, adminDeleteComment, type CommentRow } from '../api/admin';

const list = ref<CommentRow[]>([]);
const filter = ref('');

async function load() {
  list.value = await adminGetComments({ status: filter.value || undefined });
}
async function setStatus(c: CommentRow, status: CommentRow['status']) {
  await adminPatchComment(c.id, status);
  load();
}
async function remove(id: number) {
  if (!confirm('确定删除该评论？')) return;
  await adminDeleteComment(id);
  load();
}
onMounted(load);
</script>

<template>
  <div>
    <div class="head">
      <h1 class="page-title">评论管理</h1>
      <select v-model="filter" class="filter" @change="load">
        <option value="">全部</option>
        <option value="pending">待审核</option>
        <option value="approved">已通过</option>
        <option value="rejected">已拒绝</option>
      </select>
    </div>
    <table class="table">
      <thead><tr><th>内容</th><th>作者</th><th>状态</th><th>时间</th><th>操作</th></tr></thead>
      <tbody>
        <tr v-for="c in list" :key="c.id">
          <td class="content-cell">{{ c.content }}</td>
          <td>{{ c.author }}</td>
          <td><span class="badge" :class="c.status">{{ { pending: '待审核', approved: '已通过', rejected: '已拒绝' }[c.status] }}</span></td>
          <td>{{ new Date(c.createdAt).toLocaleString('zh-CN') }}</td>
          <td>
            <button v-if="c.status !== 'approved'" class="link-btn" @click="setStatus(c, 'approved')">通过</button>
            <button v-if="c.status !== 'rejected'" class="link-btn warn" @click="setStatus(c, 'rejected')">拒绝</button>
            <button class="link-btn danger" @click="remove(c.id)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="!list.length" class="empty">暂无评论</p>
  </div>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-title { font-size: 22px; margin: 0; }
.filter { padding: 6px 10px; border: 1px solid #e5e7eb; border-radius: 8px; }
.table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 10px; }
.table th, .table td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #f0f0f0; font-size: 14px; vertical-align: top; }
.table th { background: #f9fafb; color: #6b7280; }
.content-cell { max-width: 360px; white-space: pre-wrap; }
.badge { padding: 2px 10px; border-radius: 999px; font-size: 12px; }
.badge.pending { background: #fef3c7; color: #b45309; }
.badge.approved { background: #ecfdf5; color: #059669; }
.badge.rejected { background: #fee2e2; color: #dc2626; }
.link-btn { background: none; border: none; color: #3b82f6; cursor: pointer; margin-right: 8px; }
.link-btn.warn { color: #d97706; }
.link-btn.danger { color: #dc2626; }
.empty { color: #6b7280; text-align: center; padding: 32px 0; }
</style>
```

- [ ] **Step 2: 创建 `admin/src/views/FriendLinkManager.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  adminGetFriendLinks, adminPutFriendLink, adminDeleteFriendLink, type FriendLinkRow,
} from '../api/admin';

const list = ref<FriendLinkRow[]>([]);
const filter = ref('');

async function load() {
  list.value = await adminGetFriendLinks({ status: filter.value || undefined });
}
async function setStatus(l: FriendLinkRow, status: FriendLinkRow['status']) {
  await adminPutFriendLink(l.id, { status });
  load();
}
async function remove(id: number) {
  if (!confirm('确定删除该友链？')) return;
  await adminDeleteFriendLink(id);
  load();
}
onMounted(load);
</script>

<template>
  <div>
    <div class="head">
      <h1 class="page-title">友链管理</h1>
      <select v-model="filter" class="filter" @change="load">
        <option value="">全部</option>
        <option value="pending">待审核</option>
        <option value="approved">已通过</option>
        <option value="rejected">已拒绝</option>
      </select>
    </div>
    <table class="table">
      <thead><tr><th>站名</th><th>网址</th><th>简介</th><th>状态</th><th>操作</th></tr></thead>
      <tbody>
        <tr v-for="l in list" :key="l.id">
          <td>{{ l.name }}</td>
          <td><a :href="l.url" target="_blank" rel="noopener" class="url">{{ l.url }}</a></td>
          <td class="desc-cell">{{ l.description }}</td>
          <td><span class="badge" :class="l.status">{{ { pending: '待审核', approved: '已通过', rejected: '已拒绝' }[l.status] }}</span></td>
          <td>
            <button v-if="l.status !== 'approved'" class="link-btn" @click="setStatus(l, 'approved')">通过</button>
            <button v-if="l.status !== 'rejected'" class="link-btn warn" @click="setStatus(l, 'rejected')">拒绝</button>
            <button class="link-btn danger" @click="remove(l.id)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="!list.length" class="empty">暂无友链</p>
  </div>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-title { font-size: 22px; margin: 0; }
.filter { padding: 6px 10px; border: 1px solid #e5e7eb; border-radius: 8px; }
.table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 10px; }
.table th, .table td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
.table th { background: #f9fafb; color: #6b7280; }
.url { color: #3b82f6; text-decoration: none; }
.desc-cell { max-width: 240px; color: #6b7280; }
.badge { padding: 2px 10px; border-radius: 999px; font-size: 12px; }
.badge.pending { background: #fef3c7; color: #b45309; }
.badge.approved { background: #ecfdf5; color: #059669; }
.badge.rejected { background: #fee2e2; color: #dc2626; }
.link-btn { background: none; border: none; color: #3b82f6; cursor: pointer; margin-right: 8px; }
.link-btn.warn { color: #d97706; }
.link-btn.danger { color: #dc2626; }
.empty { color: #6b7280; text-align: center; padding: 32px 0; }
</style>
```

- [ ] **Step 3: 提交**

```bash
git add admin/src/views/CommentManager.vue admin/src/views/FriendLinkManager.vue
git commit -m "feat: 后台评论/友链管理"
```

### Task 39: 设置页

**Files:**
- Create: `admin/src/views/SettingsPage.vue`

- [ ] **Step 1: 创建 `admin/src/views/SettingsPage.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { adminGetSettings, adminPutSettings } from '../api/admin';

const form = ref<Record<string, string>>({});
const saved = ref(false);
const error = ref('');

onMounted(async () => {
  form.value = await adminGetSettings();
});

async function save() {
  saved.value = false;
  error.value = '';
  try {
    form.value = await adminPutSettings(form.value);
    saved.value = true;
    setTimeout(() => (saved.value = false), 2000);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败';
  }
}
</script>

<template>
  <div>
    <h1 class="page-title">设置</h1>
    <form class="settings-form" @submit.prevent="save">
      <fieldset>
        <legend>站点信息</legend>
        <label>站点名称
          <input v-model="form.site_name" placeholder="我的博客" />
        </label>
        <label>站点简介
          <input v-model="form.site_description" />
        </label>
        <label>站点地址（用于 RSS）
          <input v-model="form.site_url" placeholder="https://example.com" />
        </label>
      </fieldset>

      <fieldset>
        <legend>主题</legend>
        <label>默认主题
          <select v-model="form.default_theme">
            <option value="normal">正常主题</option>
            <option value="reader">极简阅读</option>
          </select>
        </label>
      </fieldset>

      <fieldset>
        <legend>友链</legend>
        <label>开放访客申请
          <select v-model="form.friend_link_enabled">
            <option value="1">开启</option>
            <option value="0">关闭</option>
          </select>
        </label>
      </fieldset>

      <fieldset>
        <legend>存储（图片/音频上传）</legend>
        <label>存储方式
          <select v-model="form.storage_provider">
            <option value="local">本地磁盘</option>
            <option value="cos">腾讯云 COS</option>
          </select>
        </label>
        <template v-if="form.storage_provider === 'cos'">
          <label>SecretId
            <input v-model="form.cos_secret_id" />
          </label>
          <label>SecretKey
            <input v-model="form.cos_secret_key" type="password" placeholder="留空或 **** 表示保持不变" />
          </label>
          <label>Bucket
            <input v-model="form.cos_bucket" placeholder="my-blog-1250000000" />
          </label>
          <label>Region
            <input v-model="form.cos_region" placeholder="ap-guangzhou" />
          </label>
        </template>
      </fieldset>

      <div class="actions">
        <p v-if="saved" class="saved">✓ 已保存</p>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" class="btn primary">保存设置</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.page-title { font-size: 22px; margin-bottom: 20px; }
.settings-form { display: flex; flex-direction: column; gap: 16px; max-width: 560px; }
fieldset { border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
legend { font-weight: 600; font-size: 14px; padding: 0 6px; }
label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: #6b7280; }
input, select { padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px; }
.actions { display: flex; align-items: center; gap: 12px; }
.btn.primary { background: #3b82f6; color: #fff; border: none; border-radius: 8px; padding: 10px 20px; cursor: pointer; }
.saved { color: #059669; font-size: 14px; }
.error { color: #dc2626; font-size: 14px; }
</style>
```

- [ ] **Step 2: 手动验证**

Run: `/admin/settings` 修改站点名与默认主题、切 COS 填配置 → 保存；刷新前台站点名/默认主题生效。

- [ ] **Step 3: 提交**

```bash
git add admin/src/views/SettingsPage.vue
git commit -m "feat: 后台设置页（站点/主题/存储）"
```

### Task 40: 前端里程碑验收（M4–M6 全流程）

**Files:** 无新文件

- [ ] **Step 1: 类型检查与构建**

Run: `cd site && npm run check && npm run build`；`cd admin && npm run typecheck && npm run build`
Expected: 均通过。若 Vditor 类型缺失，在 `admin/src/global.d.ts` 添加：

```ts
declare module 'vditor';
```

- [ ] **Step 2: 全流程手动验收**

三个终端：backend(3000)、site(4321)、admin(5173)。按顺序验证：
1. 前台：首页/详情/高亮/评论/回复/主题切换/分类/标签/搜索/归档/友链申请/RSS/404
2. 登录后台：仪表盘/新建分类、标签/新建文章（图片/音频上传）/审核评论与友链/修改设置
3. 后台改默认主题为 reader 后刷新前台，确认默认极简阅读风格

- [ ] **Step 3: 提交（如有修复）**

```bash
git add -A
git commit -m "fix: 前端验收问题修复"
```

---

# M7 部署

### Task 41: 后端 Dockerfile 与 .env 示例

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`
- Create: `backend/.env.example`

- [ ] **Step 1: 创建 `backend/Dockerfile`**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY drizzle ./drizzle
COPY src ./src
RUN mkdir -p /app/data /app/uploads
EXPOSE 3000
CMD ["npx", "tsx", "src/index.ts"]
```

- [ ] **Step 2: 创建 `backend/.dockerignore`**

```dockerignore
node_modules
data
uploads
*.log
test
```

- [ ] **Step 3: 创建 `backend/.env.example`**

```bash
# 服务端口
PORT=3000
# SQLite 文件路径（容器内）
DB_PATH=data/mblog.db
# 上传目录（容器内，与 nginx 共享卷）
UPLOAD_DIR=uploads
# JWT 密钥（务必改为随机长字符串）
JWT_SECRET=please-change-me-to-a-long-random-string
# 初始管理员（首次启动创建）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

- [ ] **Step 4: 提交**

```bash
git add backend/Dockerfile backend/.dockerignore backend/.env.example
git commit -m "feat: 后端 Dockerfile 与环境变量示例"
```

### Task 42: Astro 前台与 Nginx 部署配置

**Files:**
- Create: `site/Dockerfile`
- Create: `site/.dockerignore`
- Create: `deploy/nginx/Dockerfile`
- Create: `deploy/nginx/nginx.conf`

- [ ] **Step 1: 创建 `site/Dockerfile`（Astro node standalone）**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV HOST=0.0.0.0
ENV PORT=4321
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]
```

- [ ] **Step 2: 创建 `site/.dockerignore`**

```dockerignore
node_modules
dist
.astro
*.log
```

- [ ] **Step 3: 创建 `deploy/nginx/Dockerfile`（构建 admin 静态产物 + Nginx 入口）**

```dockerfile
FROM node:20-alpine AS admin-build
WORKDIR /admin
COPY admin/package.json admin/package-lock.json* ./
RUN npm install
COPY admin/ .
RUN npm run build

FROM nginx:1.27-alpine
COPY deploy/nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=admin-build /admin/dist /usr/share/nginx/html/admin
EXPOSE 80
```

- [ ] **Step 4: 创建 `deploy/nginx/nginx.conf`**

```nginx
server {
    listen 80;
    server_name _;

    # 后台 SPA（静态文件 + history 路由回退）
    location /admin/ {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /admin/index.html;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://mblog-api:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        client_max_body_size 60m;
    }

    # 本地存储的上传文件
    location /uploads/ {
        proxy_pass http://mblog-api:3000;
    }

    # Astro 前台（SSR）
    location / {
        proxy_pass http://mblog-site:4321;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

- [ ] **Step 5: 提交**

```bash
git add site/Dockerfile site/.dockerignore deploy/nginx
git commit -m "feat: Astro 前台 Dockerfile 与 Nginx 入口（admin 静态 + 反向代理）"
```

### Task 43: docker-compose 与根目录说明

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`

- [ ] **Step 1: 创建 `docker-compose.yml`（三服务）**

```yaml
services:
  mblog-api:
    build: ./backend
    restart: unless-stopped
    environment:
      PORT: "3000"
      DB_PATH: /app/data/mblog.db
      UPLOAD_DIR: /app/uploads
      JWT_SECRET: ${JWT_SECRET:-change-me}
      ADMIN_USERNAME: ${ADMIN_USERNAME:-admin}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:-admin123}
    volumes:
      - mblog-data:/app/data
      - mblog-uploads:/app/uploads

  mblog-site:
    build: ./site
    restart: unless-stopped
    environment:
      PORT: "4321"
      API_BASE: http://mblog-api:3000
    depends_on:
      - mblog-api

  mblog-web:
    build:
      context: .
      dockerfile: deploy/nginx/Dockerfile
    restart: unless-stopped
    depends_on:
      - mblog-api
      - mblog-site
    ports:
      - "${PORT:-80}:80"

volumes:
  mblog-data:
  mblog-uploads:
```

- [ ] **Step 2: 创建根目录 `.env.example`**

```bash
# compose 对外端口
PORT=80
# 生产环境务必修改！
JWT_SECRET=please-change-me-to-a-long-random-string
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

- [ ] **Step 3: 提交**

```bash
git add docker-compose.yml .env.example
git commit -m "feat: docker-compose 一键部署（api + site + web）"
```

### Task 44: README 与整体验收

**Files:**
- Create: `README.md`

- [ ] **Step 1: 创建 `README.md`**

```markdown
# MBLOG 轻量博客系统

前后端分离的个人博客：Astro(前台) + Vue(后台) + Hono + SQLite，支持双主题换肤（含阅读模式）、Markdown 写作（图片/音频）、评论审核、友链申请审核、Lenis 平滑滚动。

## 技术栈

- 前台：Astro 5（SSR）+ Vue islands（评论/主题切换/友链表单）+ Lenis
- 后台：Vue 3 SPA（Vditor 编辑器）
- 后端：Hono + Drizzle ORM + better-sqlite3（FTS5 全文搜索）
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
```

- [ ] **Step 2: 本地整体回归**

Run:
- `cd backend && npx vitest run` → 全部测试 PASS
- `cd site && npm run check && npm run build` → 通过
- `cd admin && npm run typecheck && npm run build` → 通过

- [ ] **Step 3: Docker 构建验证（可选，需 Docker 可用）**

```bash
docker compose build
```
Expected: 三个镜像构建成功（mblog-api / mblog-site / mblog-web）。

- [ ] **Step 4: 最终提交**

```bash
git add README.md
git commit -m "docs: README 使用说明"
```

---

## 计划自查记录

- **规格覆盖**：设计文档全部需求均已落到任务 —— 双主题换肤（T26/33）、分类标签管理（T14/15/37）、文章管理+Markdown 图片/音频（T16/17/36）、评论与审核（T11/18/31/38）、友链申请审核（T12/19/32）、搜索（T9/30）、归档/RSS/阅读量（T9/13）、COS 存储（T20/21/39）、Lenis 平滑滚动（T26）、Docker 部署（T41-43）。
- **占位符扫描**：全部步骤含完整代码与预期输出，无 TBD/TODO。
- **类型一致性**：`createDb`/`ensureMigrated`/`getSetting`/`getStorage`/`admin*` API 命名在前后任务间一致；`admin/src/api/admin.ts` 导出与后台页面调用一一对应；site `lib/api.ts` 类型与 backend 响应一致。
- **安全补充**：Task 22 的 settings GET/PUT 对 `cos_secret_key` 做掩码（`********` 占位符，PUT 收到占位符保留原值），Task 39 设置页提示"留空或 **** 表示保持不变"。
- **遗留说明**：Task 7 第三条测试用例依赖 Task 9 路由就位后全绿；Task 17 列表查询已用 `and(...)` 修正；Task 29 的 CommentSection 引用到 Task 31 打开。





