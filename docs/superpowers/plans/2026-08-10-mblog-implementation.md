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
├── frontend/                      # Vue 3 SPA
│   ├── package.json / tsconfig.json / vite.config.ts / index.html
│   ├── Dockerfile / nginx.conf / .dockerignore
│   └── src/
│       ├── main.ts / App.vue
│       ├── router/index.ts
│       ├── api/client.ts / posts.ts / admin.ts
│       ├── composables/useTheme.ts / useSettings.ts / useLenis.ts
│       ├── assets/themes/tokens.css / normal.css / reader.css
│       ├── layouts/NormalLayout.vue / ReaderLayout.vue
│       ├── components/PostList.vue / CommentSection.vue / ThemeToggle.vue / Pagination.vue
│       └── views/
│           ├── Home.vue / PostDetail.vue / CategoryPage.vue / TagPage.vue
│           ├── SearchPage.vue / ArchivePage.vue / FriendLinksPage.vue
│           └── admin/Login.vue / AdminLayout.vue / Dashboard.vue / PostList.vue
│               / PostEditor.vue / CategoryManager.vue / TagManager.vue
│               / CommentManager.vue / FriendLinkManager.vue / SettingsPage.vue
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
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

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
  categoryId: integer('category_id').references(() => categories.id),
  status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
  viewCount: integer('view_count').notNull().default(0),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
});

export const postTags = sqliteTable('post_tags', {
  postId: integer('post_id').references(() => posts.id, { onDelete: 'cascade' }).notNull(),
  tagId: integer('tag_id').references(() => tags.id, { onDelete: 'cascade' }).notNull(),
});

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
  tagNames: [...defaultSchema.tagNames, 'audio', 'source', 'video', 'figure', 'figcaption'],
  attributes: {
    ...defaultSchema.attributes,
    audio: [...(defaultSchema.attributes.audio ?? []), 'src', 'controls', 'preload', 'loop'],
    source: [...(defaultSchema.attributes.source ?? []), 'src', 'type'],
    video: [...(defaultSchema.attributes.video ?? []), 'src', 'controls', 'poster'],
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

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: { code: 'HTTP_ERROR', message: err.message } }, err.status);
  }
  console.error('[error]', err);
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
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { createDb } from './db';
import { ensureMigrated } from './db/migrate';

const dbPath = process.env.DB_PATH ?? 'data/mblog.db';
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
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: '用户名或密码错误' } }, 401);
    }
    const token = await signToken({ username: user.username });
    return c.json({ data: { token } });
  });

  return app;
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
import { describe, it, expect, beforeAll } from 'vitest';
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
Expected: 前两条 PASS；第三条 404 属预期（路由未实现），Task 9 后全绿。

- [ ] **Step 7: 提交**

```bash
git add backend/src/lib/jwt.ts backend/src/middleware/auth.ts backend/src/routes/admin/auth.ts backend/src/routes/admin.ts backend/test/admin.test.ts
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
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('x-real-ip') ??
      'unknown';
    const now = Date.now();
    const bucket = buckets.get(ip);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(ip, { count: 1, resetAt: now + windowMs });
    } else if (bucket.count >= max) {
      return c.json({ error: { code: 'RATE_LIMITED', message: '操作过于频繁，请稍后再试' } }, 429);
    } else {
      bucket.count += 1;
    }
    await next();
  };
}
```

- [ ] **Step 2: 更新 `backend/test/helpers.ts` 增加登录辅助函数**

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

export async function loginAsAdmin(app: ReturnType<typeof createApp>): Promise<string> {
  const res = await app.request('/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  const body = (await res.json()) as { data: { token: string } };
  return body.data.token;
}

export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
```

- [ ] **Step 3: 运行全部现有测试**

Run: `cd backend && npx vitest run`
Expected: markdown.test.ts 与 admin.test.ts 通过（admin 第三条 404 除外，Task 9 补齐）。

- [ ] **Step 4: 提交**

```bash
git add backend/src/middleware/rateLimit.ts backend/test/helpers.ts
git commit -m "feat: IP 限流中间件与测试辅助函数"
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
    const page = Math.max(1, Number(c.req.query('page') ?? 1));
    const pageSize = Math.min(50, Math.max(1, Number(c.req.query('pageSize') ?? 10)));
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
      // FTS5 全文搜索，简单去除引号避免语法错误
      const safeQ = q.replace(/"/g, ' ');
      const rows = ctx.sqlite
        .prepare('SELECT rowid AS id FROM posts_fts WHERE posts_fts MATCH ? ORDER BY rank LIMIT 200')
        .all(safeQ) as { id: number }[];
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
      .select()
      .from(posts)
      .where(and(eq(posts.slug, slug), eq(posts.status, 'published')))
      .get();
    if (!post) return c.json({ error: { code: 'NOT_FOUND', message: '文章不存在' } }, 404);

    ctx.db.update(posts).set({ viewCount: post.viewCount + 1 }).where(eq(posts.id, post.id)).run();

    const postTagList = ctx.db
      .select({ name: tags.name, slug: tags.slug })
      .from(postTags)
      .innerJoin(tags, eq(postTags.tagId, tags.id))
      .where(eq(postTags.postId, post.id))
      .all();
    const category = post.categoryId
      ? ctx.db.select().from(categories).where(eq(categories.id, post.categoryId)).get()
      : null;

    return c.json({ data: { ...post, tags: postTagList, category } });
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
    ctx.db.insert(posts).values({ title: '详情', slug: 'detail', status: 'published', contentMd: '# 标题' }).run();
    const res = await app.request('/api/posts/detail');
    const body = await res.json();
    expect(body.data.contentHtml).toContain('<h1>标题</h1>');
    const again = await app.request('/api/posts/detail');
    const body2 = await again.json();
    expect(body2.data.viewCount).toBe(2);
  });

  it('不存在的文章返回 404', async () => {
    const res = await app.request('/api/posts/nope');
    expect(res.status).toBe(404);
  });

  it('支持关键词搜索', async () => {
    ctx.db.insert(posts).values({ title: 'TypeScript 教程', slug: 'ts', status: 'published', contentMd: 'Hono 很轻' }).run();
    ctx.sqlite.prepare('INSERT INTO posts_fts(rowid, title, content_md) VALUES (?, ?, ?)').run(3, 'TypeScript 教程', 'Hono 很轻');
    const res = await app.request('/api/posts?q=Hono');
    const body = await res.json();
    expect(body.data.total).toBe(1);
    expect(body.data.list[0].slug).toBe('ts');
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
import { eq, desc, count } from 'drizzle-orm';
import { categories, tags, posts, postTags } from '../../db/schema';
import type { Db } from '../../db';

export function categoriesTagsRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/categories', (c) => {
    const rows = ctx.db.select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      postCount: count(posts.id),
    }).from(categories)
      .leftJoin(posts, eq(posts.categoryId, categories.id))
      .groupBy(categories.id)
      .orderBy(desc(categories.sortOrder))
      .all();
    return c.json({ data: rows });
  });

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
it('返回分类列表（含文章数）', async () => {
  ctx.db.insert(posts).values({ title: 'a', slug: 'a', status: 'published', contentMd: '', categoryId: 1 }).run();
  const res = await app.request('/api/categories');
  const body = await res.json();
  expect(body.data.length).toBeGreaterThan(0);
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
import { eq, and, asc, inArray } from 'drizzle-orm';
import { comments, posts } from '../../db/schema';
import { rateLimit } from '../../middleware/rateLimit';
import type { Db } from '../../db';

export function commentsRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/comments', (c) => {
    const postId = Number(c.req.query('post_id'));
    if (!postId) return c.json({ error: { code: 'INVALID', message: '缺少 post_id' } }, 400);
    const rows = ctx.db
      .select()
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

    const post = ctx.db
      .select()
      .from(posts)
      .where(and(eq(posts.id, body.postId), eq(posts.status, 'published')))
      .get();
    if (!post) return c.json({ error: { code: 'NOT_FOUND', message: '文章不存在' } }, 404);

    const parentId = typeof body.parentId === 'number' ? body.parentId : null;
    if (parentId !== null) {
      const parent = ctx.db.select({ id: comments.id }).from(comments).where(eq(comments.id, parentId)).get();
      if (!parent) return c.json({ error: { code: 'INVALID', message: '回复的评论不存在' } }, 400);
    }

    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('x-real-ip') ??
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
    const rows = ctx.db
      .select()
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
    if (!name || !url || !/^https?:\/\//.test(url)) {
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

export function settingsAdminRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/settings', (c) => {
    const keys = Object.keys(DEFAULT_SETTINGS);
    return c.json({ data: getSettings(ctx, keys) });
  });

  app.put('/settings', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return c.json({ error: { code: 'INVALID', message: '参数错误' } }, 400);
    }
    const allowed = new Set(Object.keys(DEFAULT_SETTINGS));
    for (const [key, value] of Object.entries(body)) {
      if (allowed.has(key) && typeof value === 'string') {
        setSetting(ctx, key, value);
      }
    }
    const keys = Object.keys(DEFAULT_SETTINGS);
    return c.json({ data: getSettings(ctx, keys) });
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

# M4 前端骨架

### Task 24: 初始化前端项目

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`

- [ ] **Step 1: 创建 `frontend/package.json`**

```json
{
  "name": "mblog-frontend",
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
    "lenis": "^1.3.25",
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

- [ ] **Step 2: 创建 `frontend/tsconfig.json`**

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

- [ ] **Step 3: 创建 `frontend/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
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

- [ ] **Step 4: 创建 `frontend/index.html`**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>我的博客</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: 安装依赖并验证**

Run: `cd frontend && npm install`
Expected: 安装成功。

- [ ] **Step 6: 提交**

```bash
git add frontend/package.json frontend/package-lock.json frontend/tsconfig.json frontend/vite.config.ts frontend/index.html
git commit -m "chore: 初始化前端项目（Vite + Vue 3 + TS）"
```

### Task 25: 主题系统（CSS 变量 + 双主题）

**Files:**
- Create: `frontend/src/assets/themes/tokens.css`
- Create: `frontend/src/assets/themes/normal.css`
- Create: `frontend/src/assets/themes/reader.css`
- Create: `frontend/src/composables/useTheme.ts`

- [ ] **Step 1: 创建 `frontend/src/assets/themes/tokens.css`**

```css
:root {
  --font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
    'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  --font-mono: 'SF Mono', 'JetBrains Mono', Consolas, 'Courier New', monospace;
  --font-size: 16px;
  --line-height: 1.7;
}
```

- [ ] **Step 2: 创建 `frontend/src/assets/themes/normal.css`**

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

- [ ] **Step 3: 创建 `frontend/src/assets/themes/reader.css`**

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

[data-theme='reader'] .post-card {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  border-radius: 0;
  box-shadow: none;
  padding: 32px 0;
}
```

- [ ] **Step 4: 创建 `frontend/src/composables/useTheme.ts`**

```ts
import { ref } from 'vue';

const THEME_KEY = 'mblog_theme';
const current = ref<string>(localStorage.getItem(THEME_KEY) ?? 'normal');

function applyTheme(t: string): void {
  current.value = t;
  localStorage.setItem(THEME_KEY, t);
  document.documentElement.setAttribute('data-theme', t);
}

export function useTheme() {
  return { current, applyTheme };
}
```

- [ ] **Step 5: 提交**

```bash
git add frontend/src/assets/themes frontend/src/composables/useTheme.ts
git commit -m "feat: 双主题 CSS 变量系统与 useTheme"
```

### Task 26: 布局组件与 App 组装

**Files:**
- Create: `frontend/src/main.ts`
- Create: `frontend/src/App.vue`
- Create: `frontend/src/layouts/NormalLayout.vue`
- Create: `frontend/src/layouts/ReaderLayout.vue`
- Create: `frontend/src/components/ThemeToggle.vue`

- [ ] **Step 1: 创建 `frontend/src/main.ts`**

```ts
import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import './assets/themes/tokens.css';
import './assets/themes/normal.css';
import './assets/themes/reader.css';
import 'highlight.js/styles/github.css';

createApp(App).use(router).mount('#app');
```

- [ ] **Step 2: 创建 `frontend/src/App.vue`**

```vue
<script setup lang="ts">
import { watchEffect } from 'vue';
import { useTheme } from './composables/useTheme';
import { useLenis } from './composables/useLenis';
import NormalLayout from './layouts/NormalLayout.vue';
import ReaderLayout from './layouts/ReaderLayout.vue';

const { current } = useTheme();
useLenis();
watchEffect(() => {
  document.documentElement.setAttribute('data-theme', current.value);
});
</script>

<template>
  <component :is="current === 'reader' ? ReaderLayout : NormalLayout">
    <router-view />
  </component>
</template>
```

- [ ] **Step 3: 创建 `frontend/src/composables/useLenis.ts`（平滑滚动，随主题开关）**

```ts
import { watch, onBeforeUnmount } from 'vue';
import Lenis from 'lenis';
import { useTheme } from './useTheme';

/**
 * Lenis 平滑滚动。
 * 正常主题启用平滑滚动；阅读模式（reader）恢复原生滚动，保持极简专注。
 */
export function useLenis() {
  const { current } = useTheme();
  let lenis: Lenis | null = null;

  watch(
    () => current.value,
    (theme) => {
      if (theme === 'normal') {
        if (!lenis) lenis = new Lenis({ autoRaf: true });
        lenis.start();
      } else {
        lenis?.stop();
      }
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    lenis?.destroy();
    lenis = null;
  });
}
```

- [ ] **Step 4: 创建 `frontend/src/layouts/NormalLayout.vue`**

```vue
<script setup lang="ts">
import ThemeToggle from '../components/ThemeToggle.vue';
</script>

<template>
  <div class="layout">
    <header class="layout-header">
      <div class="inner">
        <router-link class="brand" to="/">我的博客</router-link>
        <nav class="nav">
          <router-link to="/">首页</router-link>
          <router-link to="/archive">归档</router-link>
          <router-link to="/friends">友链</router-link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
    <main class="layout-main">
      <div class="container"><slot /></div>
    </main>
    <footer class="layout-footer">
      <span>© {{ new Date().getFullYear() }} 我的博客</span>
      <a :href="'/api/rss'" target="_blank">RSS</a>
    </footer>
  </div>
</template>

<style scoped>
.layout-header {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}
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
.nav a { color: var(--color-text-muted); text-decoration: none; }
.nav a.router-link-active { color: var(--color-primary); }
.layout-main { min-height: calc(100vh - 120px); }
.container { max-width: var(--max-width); margin: 0 auto; padding: 24px 20px 48px; }
.layout-footer {
  border-top: 1px solid var(--color-border);
  padding: 20px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 14px;
  display: flex;
  gap: 16px;
  justify-content: center;
}
</style>
```

- [ ] **Step 5: 创建 `frontend/src/layouts/ReaderLayout.vue`**

```vue
<script setup lang="ts">
import ThemeToggle from '../components/ThemeToggle.vue';
</script>

<template>
  <div class="reader-layout">
    <header class="reader-header">
      <div class="inner">
        <router-link class="brand" to="/">我的博客</router-link>
        <ThemeToggle />
      </div>
    </header>
    <main class="reader-main"><slot /></main>
    <footer class="reader-footer">
      <router-link to="/">首页</router-link>
      <router-link to="/archive">归档</router-link>
      <a :href="'/api/rss'" target="_blank">RSS</a>
    </footer>
  </div>
</template>

<style scoped>
.reader-header {
  border-bottom: 1px solid var(--color-border);
}
.inner {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 0 20px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.brand { font-weight: 600; text-decoration: none; color: var(--color-text); }
.reader-main { max-width: var(--max-width); margin: 0 auto; padding: 40px 20px 80px; min-height: calc(100vh - 120px); }
.reader-footer {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 24px 20px 48px;
  display: flex;
  gap: 20px;
  color: var(--color-text-muted);
  border-top: 1px solid var(--color-border);
}
.reader-footer a { color: var(--color-text-muted); text-decoration: none; }
</style>
```

- [ ] **Step 6: 创建 `frontend/src/components/ThemeToggle.vue`**

```vue
<script setup lang="ts">
import { useTheme } from '../composables/useTheme';

const { current, applyTheme } = useTheme();
function toggle() {
  applyTheme(current.value === 'normal' ? 'reader' : 'normal');
}
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

- [ ] **Step 7: 提交**

```bash
git add frontend/src/main.ts frontend/src/App.vue frontend/src/layouts frontend/src/components/ThemeToggle.vue frontend/src/composables/useLenis.ts
git commit -m "feat: 布局组件、主题切换与 Lenis 平滑滚动"
```

### Task 27: 路由与 API 客户端

**Files:**
- Create: `frontend/src/router/index.ts`
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/posts.ts`
- Create: `frontend/src/api/admin.ts`

- [ ] **Step 1: 创建 `frontend/src/router/index.ts`**

```ts
import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('../views/Home.vue') },
    { path: '/post/:slug', name: 'post', component: () => import('../views/PostDetail.vue') },
    { path: '/category/:slug', name: 'category', component: () => import('../views/CategoryPage.vue') },
    { path: '/tag/:slug', name: 'tag', component: () => import('../views/TagPage.vue') },
    { path: '/search', name: 'search', component: () => import('../views/SearchPage.vue') },
    { path: '/archive', name: 'archive', component: () => import('../views/ArchivePage.vue') },
    { path: '/friends', name: 'friends', component: () => import('../views/FriendLinksPage.vue') },
    { path: '/login', name: 'login', component: () => import('../views/admin/Login.vue') },
    {
      path: '/admin',
      component: () => import('../views/admin/AdminLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'dashboard', component: () => import('../views/admin/Dashboard.vue') },
        { path: 'posts', name: 'admin-posts', component: () => import('../views/admin/PostList.vue') },
        { path: 'posts/new', name: 'admin-post-new', component: () => import('../views/admin/PostEditor.vue') },
        { path: 'posts/:id', name: 'admin-post-edit', component: () => import('../views/admin/PostEditor.vue') },
        { path: 'categories', name: 'admin-categories', component: () => import('../views/admin/CategoryManager.vue') },
        { path: 'tags', name: 'admin-tags', component: () => import('../views/admin/TagManager.vue') },
        { path: 'comments', name: 'admin-comments', component: () => import('../views/admin/CommentManager.vue') },
        { path: 'friends', name: 'admin-friends', component: () => import('../views/admin/FriendLinkManager.vue') },
        { path: 'settings', name: 'admin-settings', component: () => import('../views/admin/SettingsPage.vue') },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach((to) => {
  const token = localStorage.getItem('admin_token');
  if (to.meta.requiresAuth && !token) return { name: 'login' };
  if (to.name === 'login' && token) return { name: 'dashboard' };
});
```

- [ ] **Step 2: 创建 `frontend/src/api/client.ts`**

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

- [ ] **Step 3: 创建 `frontend/src/api/posts.ts`**

```ts
import { request } from './client';

export interface PostListItem {
  id: number;
  title: string;
  slug: string;
  summary: string;
  cover: string;
  viewCount: number;
  categoryId: number | null;
  createdAt: number;
}

export interface PostDetail extends PostListItem {
  contentMd: string;
  contentHtml: string;
  status: 'draft' | 'published';
  tags: { name: string; slug: string }[];
  category: { id: number; name: string; slug: string } | null;
}

export interface Page<T> {
  list: T[];
  total: number;
}

export async function getPosts(params: { page?: number; category?: string; tag?: string; q?: string } = {}): Promise<Page<PostListItem>> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.category) qs.set('category', params.category);
  if (params.tag) qs.set('tag', params.tag);
  if (params.q) qs.set('q', params.q);
  return request<Page<PostListItem>>(`/posts?${qs.toString()}`);
}

export async function getPost(slug: string): Promise<PostDetail> {
  return request<PostDetail>(`/posts/${slug}`);
}

export async function getCategories(): Promise<{ id: number; name: string; slug: string; postCount: number }[]> {
  return request('/categories');
}

export async function getTags(): Promise<{ id: number; name: string; slug: string; postCount: number }[]> {
  return request('/tags');
}

export async function getArchive(): Promise<{ month: string; items: { createdAt: number; title: string; slug: string }[] }[]> {
  return request('/archive');
}

export async function getPublicSettings(): Promise<{ siteName: string; siteDesc: string; theme: string; friendLinkEnabled: boolean }> {
  return request('/settings/public');
}
```

- [ ] **Step 4: 创建 `frontend/src/api/admin.ts`**

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

export function logout() {
  localStorage.removeItem('admin_token');
}
```

- [ ] **Step 5: 提交**

```bash
git add frontend/src/router/index.ts frontend/src/api
git commit -m "feat: 路由与 API 客户端封装"
```

---

# M5 前台页面

### Task 28: 首页文章列表

**Files:**
- Create: `frontend/src/components/PostList.vue`
- Create: `frontend/src/components/Pagination.vue`
- Create: `frontend/src/views/Home.vue`

- [ ] **Step 1: 创建 `frontend/src/components/PostList.vue`**

```vue
<script setup lang="ts">
import type { PostListItem } from '../api/posts';

defineProps<{ posts: PostListItem[] }>();
</script>

<template>
  <div class="post-list">
    <article v-for="post in posts" :key="post.id" class="post-card">
      <h2 class="post-title">
        <router-link :to="`/post/${post.slug}`">{{ post.title }}</router-link>
      </h2>
      <p v-if="post.summary" class="post-summary">{{ post.summary }}</p>
      <div class="post-meta">
        <span>{{ new Date(post.createdAt).toLocaleDateString('zh-CN') }}</span>
        <span>👁 {{ post.viewCount }}</span>
      </div>
    </article>
    <p v-if="posts.length === 0" class="post-empty">暂无文章</p>
  </div>
</template>

<style scoped>
.post-list { display: flex; flex-direction: column; gap: 16px; }
.post-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); box-shadow: var(--shadow); padding: var(--card-padding); }
.post-title { margin: 0 0 8px; font-size: 20px; }
.post-title a { color: var(--color-text); text-decoration: none; }
.post-title a:hover { color: var(--color-primary); }
.post-summary { color: var(--color-text-muted); margin: 0 0 12px; font-size: 14px; line-height: 1.6; }
.post-meta { display: flex; gap: 16px; color: var(--color-text-muted); font-size: 13px; }
.post-empty { text-align: center; color: var(--color-text-muted); padding: 48px 0; }
</style>
```

- [ ] **Step 2: 创建 `frontend/src/components/Pagination.vue`**

```vue
<script setup lang="ts">
defineProps<{ page: number; total: number; pageSize: number }>();
const emit = defineEmits<{ (e: 'change', page: number): void }>();
</script>

<template>
  <div v-if="total > pageSize" class="pagination">
    <button :disabled="page <= 1" @click="emit('change', page - 1)">上一页</button>
    <span class="page-info">{{ page }} / {{ Math.ceil(total / pageSize) }}</span>
    <button :disabled="page * pageSize >= total" @click="emit('change', page + 1)">下一页</button>
  </div>
</template>

<style scoped>
.pagination { display: flex; gap: 12px; align-items: center; justify-content: center; padding: 24px 0; }
.pagination button { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); border-radius: var(--radius); padding: 6px 14px; cursor: pointer; }
.pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
.page-info { color: var(--color-text-muted); font-size: 14px; }
</style>
```

- [ ] **Step 3: 创建 `frontend/src/views/Home.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getPosts, type PostListItem } from '../api/posts';
import PostList from '../components/PostList.vue';
import Pagination from '../components/Pagination.vue';

const pageSize = 10;
const page = ref(1);
const total = ref(0);
const posts = ref<PostListItem[]>([]);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    const data = await getPosts({ page: page.value });
    posts.value = data.list;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}
function changePage(p: number) {
  page.value = p;
  load();
}
onMounted(load);
</script>

<template>
  <div>
    <p v-if="loading" class="loading">加载中…</p>
    <PostList :posts="posts" />
    <Pagination :page="page" :total="total" :page-size="pageSize" @change="changePage" />
  </div>
</template>

<style scoped>
.loading { text-align: center; color: var(--color-text-muted); }
</style>
```

- [ ] **Step 4: 手动验证**

Run: `cd frontend && npm run dev`（另开终端 `cd backend && npm run dev`）
Expected: 浏览器打开 `http://localhost:5173`，首页渲染文章卡片列表。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/components/PostList.vue frontend/src/components/Pagination.vue frontend/src/views/Home.vue
git commit -m "feat: 首页文章列表与分页"
```

### Task 29: 文章详情页（渲染 + 阅读模式按钮）

**Files:**
- Create: `frontend/src/views/PostDetail.vue`

- [ ] **Step 1: 创建 `frontend/src/views/PostDetail.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getPost, type PostDetail } from '../api/posts';
import { useTheme } from '../composables/useTheme';
import CommentSection from '../components/CommentSection.vue';

const route = useRoute();
const { current, applyTheme } = useTheme();
const post = ref<PostDetail | null>(null);
const notFound = ref(false);

async function load() {
  try {
    post.value = await getPost(String(route.params.slug));
  } catch {
    notFound.value = true;
  }
}
onMounted(load);

function toggleReadMode() {
  applyTheme(current.value === 'normal' ? 'reader' : 'normal');
}
</script>

<template>
  <div v-if="post" class="post-detail">
    <div class="post-head">
      <h1>{{ post.title }}</h1>
      <div class="post-meta">
        <span v-if="post.category">
          <router-link :to="`/category/${post.category.slug}`">{{ post.category.name }}</router-link>
        </span>
        <span>{{ new Date(post.createdAt).toLocaleDateString('zh-CN') }}</span>
        <span>👁 {{ post.viewCount }}</span>
        <button class="read-toggle" type="button" @click="toggleReadMode">
          {{ current === 'normal' ? '📖 阅读模式' : '🌐 退出阅读模式' }}
        </button>
      </div>
      <div v-if="post.tags.length" class="post-tags">
        <router-link v-for="t in post.tags" :key="t.slug" :to="`/tag/${t.slug}`" class="tag">#{{ t.name }}</router-link>
      </div>
    </div>
    <!-- 后端已渲染并防 XSS 的 HTML -->
    <article class="markdown-body" v-html="post.contentHtml" />
    <CommentSection :post-id="post.id" />
  </div>
  <p v-else-if="notFound" class="not-found">文章不存在或已下线</p>
  <p v-else class="loading">加载中…</p>
</template>

<style scoped>
.post-detail { max-width: var(--max-width); margin: 0 auto; }
.post-head { margin-bottom: 24px; }
.post-head h1 { font-size: 28px; margin: 0 0 12px; }
.post-meta { display: flex; gap: 16px; flex-wrap: wrap; color: var(--color-text-muted); font-size: 13px; align-items: center; }
.post-meta a { color: var(--color-primary); text-decoration: none; }
.read-toggle { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); border-radius: var(--radius); padding: 4px 10px; cursor: pointer; font-size: 13px; }
.read-toggle:hover { border-color: var(--color-primary); color: var(--color-primary); }
.post-tags { margin-top: 12px; display: flex; gap: 8px; }
.tag { color: var(--color-primary); font-size: 13px; text-decoration: none; }
.not-found, .loading { text-align: center; color: var(--color-text-muted); padding: 48px 0; }
</style>

<style>
/* markdown 正文排版（非 scoped，作用于后端渲染的 HTML） */
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
</style>
```

> 注：`CommentSection.vue` 在 Task 31 创建，提交前先不提交 PostDetail.vue 的引用即可，或一并留到 Task 31 后运行验证。

- [ ] **Step 2: 手动验证**

Run: 打开 `http://localhost:5173/post/<slug>`
Expected: 文章正文渲染、代码高亮、可点击"阅读模式"切换主题。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/views/PostDetail.vue
git commit -m "feat: 文章详情页（渲染+阅读模式）"
```

### Task 30: 分类 / 标签 / 搜索 / 归档页

**Files:**
- Create: `frontend/src/views/CategoryPage.vue`
- Create: `frontend/src/views/TagPage.vue`
- Create: `frontend/src/views/SearchPage.vue`
- Create: `frontend/src/views/ArchivePage.vue`

- [ ] **Step 1: 创建 `frontend/src/views/CategoryPage.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getPosts, type PostListItem } from '../api/posts';
import PostList from '../components/PostList.vue';

const route = useRoute();
const posts = ref<PostListItem[]>([]);
const categoryName = ref('');

onMounted(async () => {
  const data = await getPosts({ category: String(route.params.slug) });
  posts.value = data.list;
  const cats = await import('../api/posts').then((m) => m.getCategories());
  categoryName.value = cats.find((c) => c.slug === route.params.slug)?.name ?? String(route.params.slug);
});
</script>

<template>
  <div>
    <h1 class="page-title">分类：{{ categoryName }}</h1>
    <PostList :posts="posts" />
  </div>
</template>

<style scoped>
.page-title { font-size: 22px; margin-bottom: 20px; }
</style>
```

- [ ] **Step 2: 创建 `frontend/src/views/TagPage.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getPosts, type PostListItem } from '../api/posts';
import PostList from '../components/PostList.vue';

const route = useRoute();
const posts = ref<PostListItem[]>([]);
const tagName = ref('');

onMounted(async () => {
  const data = await getPosts({ tag: String(route.params.slug) });
  posts.value = data.list;
  const tags = await import('../api/posts').then((m) => m.getTags());
  tagName.value = tags.find((t) => t.slug === route.params.slug)?.name ?? String(route.params.slug);
});
</script>

<template>
  <div>
    <h1 class="page-title">标签：#{{ tagName }}</h1>
    <PostList :posts="posts" />
  </div>
</template>

<style scoped>
.page-title { font-size: 22px; margin-bottom: 20px; }
</style>
```

- [ ] **Step 3: 创建 `frontend/src/views/SearchPage.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getPosts, type PostListItem } from '../api/posts';
import PostList from '../components/PostList.vue';

const router = useRouter();
const keyword = ref('');
const posts = ref<PostListItem[]>([]);
const searched = ref(false);

function doSearch() {
  if (!keyword.value.trim()) return;
  router.replace({ path: '/search', query: { q: keyword.value } });
}

onMounted(async () => {
  const q = router.currentRoute.value.query.q as string | undefined;
  if (q) {
    keyword.value = q;
    const data = await getPosts({ q });
    posts.value = data.list;
    searched.value = true;
  }
});
</script>

<template>
  <div>
    <form class="search-form" @submit.prevent="doSearch">
      <input v-model="keyword" placeholder="搜索文章标题或正文…" />
      <button type="submit">搜索</button>
    </form>
    <p v-if="searched" class="result-info">共找到 {{ posts.length }} 篇相关文章</p>
    <PostList :posts="posts" />
  </div>
</template>

<style scoped>
.search-form { display: flex; gap: 8px; margin-bottom: 20px; }
.search-form input { flex: 1; border: 1px solid var(--color-border); border-radius: var(--radius); padding: 8px 12px; background: var(--color-surface); color: var(--color-text); }
.search-form button { border: none; background: var(--color-primary); color: var(--color-primary-contrast); border-radius: var(--radius); padding: 8px 16px; cursor: pointer; }
.result-info { color: var(--color-text-muted); font-size: 14px; margin-bottom: 16px; }
</style>
```

- [ ] **Step 4: 创建 `frontend/src/views/ArchivePage.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getArchive } from '../api/posts';

const groups = ref<Awaited<ReturnType<typeof getArchive>>>([]);

onMounted(async () => {
  groups.value = await getArchive();
});
</script>

<template>
  <div>
    <h1 class="page-title">归档</h1>
    <section v-for="g in groups" :key="g.month" class="archive-group">
      <h2 class="month">{{ g.month }}</h2>
      <ul>
        <li v-for="item in g.items" :key="item.slug">
          <span class="date">{{ new Date(item.createdAt).toLocaleDateString('zh-CN') }}</span>
          <router-link :to="`/post/${item.slug}`">{{ item.title }}</router-link>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.page-title { font-size: 22px; margin-bottom: 20px; }
.archive-group { margin-bottom: 24px; }
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
git add frontend/src/views/CategoryPage.vue frontend/src/views/TagPage.vue frontend/src/views/SearchPage.vue frontend/src/views/ArchivePage.vue
git commit -m "feat: 分类/标签/搜索/归档页面"
```

### Task 31: 评论组件（列表 + 发表）

**Files:**
- Create: `frontend/src/components/CommentSection.vue`
- Modify: `frontend/src/views/PostDetail.vue`（打开注释引用）

- [ ] **Step 1: 创建 `frontend/src/components/CommentSection.vue`**

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

// 顶层评论 + 挂在其下的子评论（回复树，仅一层缩进）
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

- [ ] **Step 2: 更新 `frontend/src/views/PostDetail.vue` 移除注释**

确认 PostDetail.vue 中 `import CommentSection from '../components/CommentSection.vue';` 与 `<CommentSection :post-id="post.id" />` 已存在且未注释。

- [ ] **Step 3: 手动验证**

Run: 打开 `http://localhost:5173/post/<slug>`，滚动到底部
Expected: 评论列表加载、可提交评论并提示"等待审核"。

- [ ] **Step 4: 提交**

```bash
git add frontend/src/components/CommentSection.vue frontend/src/views/PostDetail.vue
git commit -m "feat: 评论组件（列表+发表）"
```

### Task 32: 友链页（列表 + 申请）

**Files:**
- Create: `frontend/src/views/FriendLinksPage.vue`

- [ ] **Step 1: 创建 `frontend/src/views/FriendLinksPage.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getPublicSettings } from '../api/posts';

interface FriendLink { id: number; name: string; url: string; description: string; avatar: string }
const links = ref<FriendLink[]>([]);
const enabled = ref(true);
const form = ref({ name: '', url: '', description: '' });
const message = ref('');
const submitting = ref(false);

async function load() {
  const [linkRes, settings] = await Promise.all([fetch('/api/friend-links'), getPublicSettings()]);
  links.value = (await linkRes.json()).data;
  enabled.value = settings.friendLinkEnabled;
}

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

onMounted(load);
</script>

<template>
  <div>
    <h1 class="page-title">友情链接</h1>

    <div v-if="links.length" class="link-grid">
      <a v-for="l in links" :key="l.id" class="link-card" :href="l.url" target="_blank" rel="noopener">
        <div class="link-avatar">{{ l.name.slice(0, 1) }}</div>
        <div>
          <div class="link-name">{{ l.name }}</div>
          <div v-if="l.description" class="link-desc">{{ l.description }}</div>
        </div>
      </a>
    </div>
    <p v-else class="link-empty">暂无友链</p>

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
    <p v-else class="link-empty">友链申请已关闭</p>
  </div>
</template>

<style scoped>
.page-title { font-size: 22px; margin-bottom: 20px; }
.link-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
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
.link-empty { color: var(--color-text-muted); padding: 24px 0; }
.link-form { margin-top: 32px; display: flex; flex-direction: column; gap: 10px; max-width: 480px; }
.link-form h2 { font-size: 16px; margin: 0 0 4px; }
.link-form input { border: 1px solid var(--color-border); border-radius: var(--radius); padding: 8px 12px; background: var(--color-surface); color: var(--color-text); }
.row.end { display: flex; justify-content: flex-end; align-items: center; gap: 12px; }
.link-form button { border: none; background: var(--color-primary); color: var(--color-primary-contrast); border-radius: var(--radius); padding: 8px 18px; cursor: pointer; }
.link-form button:disabled { opacity: 0.6; }
.link-message { color: var(--color-text-muted); font-size: 13px; }
</style>
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/views/FriendLinksPage.vue
git commit -m "feat: 友链页（列表+申请）"
```

### Task 33: 站点设置注入与前台验收

**Files:**
- Create: `frontend/src/composables/useSettings.ts`
- Modify: `frontend/src/main.ts`

- [ ] **Step 1: 创建 `frontend/src/composables/useSettings.ts`**

```ts
import { ref } from 'vue';
import { getPublicSettings } from '../api/posts';

const settings = ref<{ siteName: string; siteDesc: string; theme: string; friendLinkEnabled: boolean } | null>(null);

export async function loadSettings() {
  try {
    settings.value = await getPublicSettings();
  } catch {
    settings.value = { siteName: '我的博客', siteDesc: '', theme: 'normal', friendLinkEnabled: true };
  }
  return settings.value;
}

export function useSettings() {
  return { settings, loadSettings };
}
```

- [ ] **Step 2: 更新 `frontend/src/main.ts`**

```ts
import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import { loadSettings } from './composables/useSettings';
import './assets/themes/tokens.css';
import './assets/themes/normal.css';
import './assets/themes/reader.css';
import 'highlight.js/styles/github.css';

async function bootstrap() {
  await loadSettings(); // 先拉取站点设置（含默认主题）
  createApp(App).use(router).mount('#app');
}
void bootstrap();
```

- [ ] **Step 3: 更新 `frontend/src/App.vue` 使用后端默认主题**

```vue
<script setup lang="ts">
import { watchEffect, onMounted } from 'vue';
import { useTheme } from './composables/useTheme';
import { useSettings } from './composables/useSettings';
import NormalLayout from './layouts/NormalLayout.vue';
import ReaderLayout from './layouts/ReaderLayout.vue';

const { current, applyTheme } = useTheme();
const { settings } = useSettings();

onMounted(() => {
  if (!localStorage.getItem('mblog_theme') && settings.value?.theme) {
    applyTheme(settings.value.theme);
  }
});

watchEffect(() => {
  document.documentElement.setAttribute('data-theme', current.value);
});
</script>

<template>
  <component :is="current === 'reader' ? ReaderLayout : NormalLayout">
    <router-view />
  </component>
</template>
```

- [ ] **Step 4: 前台手动验收**

Run: 两个终端分别启动前后端，浏览器逐一检查：
- 首页列表、详情、代码高亮、评论发表
- 主题切换（导航栏按钮 + 文章页阅读模式按钮）
- 分类 / 标签 / 搜索 / 归档 / 友链申请
- RSS：`http://localhost:5173/api/rss`（经 vite 代理）

- [ ] **Step 5: 提交**

```bash
git add frontend/src/composables/useSettings.ts frontend/src/main.ts frontend/src/App.vue
git commit -m "feat: 站点设置注入（默认主题/站点名）"
```

---

# M6 后台页面

### Task 34: 登录页与后台布局

**Files:**
- Create: `frontend/src/views/admin/Login.vue`
- Create: `frontend/src/views/admin/AdminLayout.vue`

- [ ] **Step 1: 创建 `frontend/src/views/admin/Login.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { login } from '../../api/admin';

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
    router.push('/admin');
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
      <h1>管理后台</h1>
      <input v-model="username" placeholder="用户名" autocomplete="username" />
      <input v-model="password" type="password" placeholder="密码" autocomplete="current-password" />
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="loading">{{ loading ? '登录中…' : '登录' }}</button>
    </form>
  </div>
</template>

<style scoped>
.login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--color-bg); }
.login-card { width: 320px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 32px 24px; display: flex; flex-direction: column; gap: 12px; }
.login-card h1 { font-size: 20px; margin: 0 0 8px; text-align: center; }
.login-card input { border: 1px solid var(--color-border); border-radius: var(--radius); padding: 10px 12px; }
.login-card button { border: none; background: var(--color-primary); color: var(--color-primary-contrast); border-radius: var(--radius); padding: 10px; cursor: pointer; font-size: 15px; }
.login-card button:disabled { opacity: 0.6; }
.error { color: #dc2626; font-size: 13px; margin: 0; }
</style>
```

- [ ] **Step 2: 创建 `frontend/src/views/admin/AdminLayout.vue`**

```vue
<script setup lang="ts">
import { useRouter } from 'vue-router';
import { logout } from '../../api/admin';

const router = useRouter();
function doLogout() {
  logout();
  router.push('/');
}
</script>

<template>
  <div class="admin-layout">
    <aside class="admin-side">
      <div class="admin-brand">MBLOG 后台</div>
      <nav>
        <router-link to="/admin">仪表盘</router-link>
        <router-link to="/admin/posts">文章</router-link>
        <router-link to="/admin/categories">分类</router-link>
        <router-link to="/admin/tags">标签</router-link>
        <router-link to="/admin/comments">评论</router-link>
        <router-link to="/admin/friends">友链</router-link>
        <router-link to="/admin/settings">设置</router-link>
      </nav>
      <div class="admin-actions">
        <router-link to="/">← 查看站点</router-link>
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

Run: 打开 `http://localhost:5173/login`，用 `admin / admin123` 登录
Expected: 跳转 `/admin`，侧边导航可用，未登录访问 `/admin` 自动跳回登录页。

- [ ] **Step 4: 提交**

```bash
git add frontend/src/views/admin/Login.vue frontend/src/views/admin/AdminLayout.vue
git commit -m "feat: 后台登录页与布局"
```

### Task 35: 仪表盘

**Files:**
- Create: `frontend/src/views/admin/Dashboard.vue`

- [ ] **Step 1: 创建 `frontend/src/views/admin/Dashboard.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getStats } from '../../api/admin';

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
git add frontend/src/views/admin/Dashboard.vue
git commit -m "feat: 后台仪表盘"
```

### Task 36: 文章列表与 Markdown 编辑器

**Files:**
- Create: `frontend/src/views/admin/PostList.vue`
- Create: `frontend/src/views/admin/PostEditor.vue`

- [ ] **Step 1: 创建 `frontend/src/views/admin/PostList.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { adminGetPosts, adminDeletePost, type AdminPostRow } from '../../api/admin';

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
          <td>{{ new Date(p.updatedAt ?? p.createdAt).toLocaleDateString('zh-CN') }}</td>
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

- [ ] **Step 2: 创建 `frontend/src/views/admin/PostEditor.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import {
  adminGetPost, adminCreatePost, adminUpdatePost,
  adminGetCategories, adminGetTags, uploadFile,
} from '../../api/admin';

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

> 说明：Vditor 上传配置中 `fieldName`/`fileVal`/`filename` 指向同一个字段名 `file`，与后端 `body.file` 对应。若实测上传 400，检查字段名一致性。

- [ ] **Step 3: 手动验证**

Run: `/admin/posts/new` 打开编辑器，测试：输入标题与 Markdown、点上传插入图片、点"♪ 插入音频"按钮上传音频、存草稿、发布、再编辑回显。

- [ ] **Step 4: 提交**

```bash
git add frontend/src/views/admin/PostList.vue frontend/src/views/admin/PostEditor.vue
git commit -m "feat: 后台文章列表与 Vditor 编辑器（图片/音频上传）"
```

### Task 37: 分类与标签管理页

**Files:**
- Create: `frontend/src/views/admin/CategoryManager.vue`
- Create: `frontend/src/views/admin/TagManager.vue`

- [ ] **Step 1: 创建 `frontend/src/views/admin/CategoryManager.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  adminGetCategories, adminCreateCategory, adminUpdateCategory, adminDeleteCategory,
  type CategoryRow,
} from '../../api/admin';

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

- [ ] **Step 2: 创建 `frontend/src/views/admin/TagManager.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  adminGetTags, adminCreateTag, adminUpdateTag, adminDeleteTag, type TagRow,
} from '../../api/admin';

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
git add frontend/src/views/admin/CategoryManager.vue frontend/src/views/admin/TagManager.vue
git commit -m "feat: 后台分类/标签管理"
```

### Task 38: 评论与友链管理页

**Files:**
- Create: `frontend/src/views/admin/CommentManager.vue`
- Create: `frontend/src/views/admin/FriendLinkManager.vue`

- [ ] **Step 1: 创建 `frontend/src/views/admin/CommentManager.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { adminGetComments, adminPatchComment, adminDeleteComment, type CommentRow } from '../../api/admin';

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

- [ ] **Step 2: 创建 `frontend/src/views/admin/FriendLinkManager.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  adminGetFriendLinks, adminPutFriendLink, adminDeleteFriendLink, type FriendLinkRow,
} from '../../api/admin';

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
git add frontend/src/views/admin/CommentManager.vue frontend/src/views/admin/FriendLinkManager.vue
git commit -m "feat: 后台评论/友链管理"
```

### Task 39: 设置页（站点/主题/存储）

**Files:**
- Create: `frontend/src/views/admin/SettingsPage.vue`

- [ ] **Step 1: 创建 `frontend/src/views/admin/SettingsPage.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { adminGetSettings, adminPutSettings } from '../../api/admin';

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
            <input v-model="form.cos_secret_key" type="password" />
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

Run: `/admin/settings` 修改站点名与默认主题、切 COS 填配置 → 保存，刷新前台站点名/主题生效。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/views/admin/SettingsPage.vue
git commit -m "feat: 后台设置页（站点/主题/存储）"
```

### Task 40: 前端里程碑验收（M4–M6 全流程）

**Files:** 无新文件

- [ ] **Step 1: 类型检查**

Run: `cd frontend && npx vue-tsc --noEmit`
Expected: 无类型错误。若 Vditor 类型缺失导致报错，在 `frontend/src/global.d.ts` 添加：

```ts
declare module 'vditor';
```

- [ ] **Step 2: 构建验证**

Run: `cd frontend && npm run build`
Expected: `dist/` 生成成功。

- [ ] **Step 3: 全流程手动验收**

两个终端分别跑 `backend npm run dev` 与 `frontend npm run dev`，按顺序验证：
1. 前台：首页 / 详情 / 高亮 / 评论 / 主题切换 / 分类 / 标签 / 搜索 / 归档 / 友链申请 / RSS
2. 登录后台：仪表盘 / 新建分类、标签 / 新建文章（含图片/音频上传）/ 审核评论与友链 / 修改设置
3. 修改默认主题为 reader 后刷新前台，确认默认极简阅读风格

- [ ] **Step 4: 提交（如有修复）**

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

### Task 42: 前端 Dockerfile 与 Nginx 配置

**Files:**
- Create: `frontend/Dockerfile`
- Create: `frontend/nginx.conf`
- Create: `frontend/.dockerignore`

- [ ] **Step 1: 创建 `frontend/Dockerfile`（多阶段构建）**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

- [ ] **Step 2: 创建 `frontend/nginx.conf`**

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # 前端 SPA 路由回退
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 反向代理
    location /api/ {
        proxy_pass http://mblog-api:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        client_max_body_size 60m;
    }

    # 上传的本地文件（本地存储时）
    location /uploads/ {
        proxy_pass http://mblog-api:3000;
    }

    # 静态资源缓存
    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

- [ ] **Step 3: 创建 `frontend/.dockerignore`**

```dockerignore
node_modules
dist
*.log
```

- [ ] **Step 4: 提交**

```bash
git add frontend/Dockerfile frontend/nginx.conf frontend/.dockerignore
git commit -m "feat: 前端 Dockerfile（多阶段）与 Nginx 配置"
```

### Task 43: docker-compose 与根目录说明

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`

- [ ] **Step 1: 创建 `docker-compose.yml`**

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

  mblog-web:
    build: ./frontend
    restart: unless-stopped
    depends_on:
      - mblog-api
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
git commit -m "feat: docker-compose 一键部署配置"
```

### Task 44: README 与整体验收

**Files:**
- Create: `README.md`

- [ ] **Step 1: 创建 `README.md`**

```markdown
# MBLOG 轻量博客系统

前后端分离的个人博客：Vue 3 + Hono + SQLite，支持双主题换肤、Markdown（图片/音频）、评论审核、友链申请审核。

## 技术栈

- 前端：Vite + Vue 3 + Vue Router + Vditor
- 后端：Hono + Drizzle ORM + better-sqlite3（FTS5 全文搜索）
- 存储：本地磁盘 / 腾讯云 COS（后台可切换）
- 部署：Docker Compose（Nginx + API）

## 本地开发

```bash
# 终端 1：后端（首次需建库并创建管理员 admin/admin123）
cd backend
npm install
npm run dev

# 终端 2：前端
cd frontend
npm install
npm run dev
```

打开 http://localhost:5173 （前端），后台 http://localhost:5173/login。

## 测试

```bash
cd backend && npm test
```

## Docker 部署

```bash
cp .env.example .env   # 修改 JWT_SECRET 与管理员密码
docker compose up -d --build
```

- 数据卷 `mblog-data`（SQLite）与 `mblog-uploads`（上传文件），备份即复制两卷。
- 后台地址 http://<服务器>/login

## 常用操作

- 上传存储切换：后台「设置 → 存储」
- 默认主题切换：后台「设置 → 主题」
- 评论/友链审核：后台对应管理页
```

- [ ] **Step 2: 本地整体回归**

Run: `cd backend && npx vitest run` 与 `cd frontend && npx vue-tsc --noEmit && npm run build`
Expected: 后端全部测试 PASS；前端类型检查与构建通过。

- [ ] **Step 3: Docker 构建验证（可选，需 Docker 可用）**

```bash
docker compose build
```
Expected: 两个镜像构建成功。

- [ ] **Step 4: 最终提交**

```bash
git add README.md
git commit -m "docs: README 使用说明"
```

---

## 计划自查记录

- **规格覆盖**：设计文档中全部需求均已落到任务 —— 双主题换肤（T25/26/33）、分类标签管理（T14/15/37）、文章管理+Markdown 图片/音频（T16/17/36）、评论组件与审核（T11/18/31/38）、友链申请审核（T12/19/32）、搜索（T9）、归档/RSS/阅读量（T9/13）、COS 存储配置（T20/21/39）、Docker 部署（T41-43）。
- **占位符扫描**：全部步骤含完整代码与预期输出，无 TBD/TODO。
- **类型一致性**：`createDb`/`ensureMigrated`/`getSetting`/`getStorage`/`admin*` API 等命名在前后任务间一致；前端 `admin.ts` 导出与后台页面调用一一对应。
- **遗留说明**：Task 7 第三条测试用例依赖 Task 9 路由就位后全绿；Task 17 列表查询已用 `and(...)` 修正。





