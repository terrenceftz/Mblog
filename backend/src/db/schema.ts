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
  cover: text('cover').notNull().default(''),
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
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
  collectionId: integer('collection_id'),
  status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
  viewCount: integer('view_count').notNull().default(0),
  likeCount: integer('like_count').notNull().default(0),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
});

// 合集/专栏（系列文章聚合，如「vibe-coding 系列」）
export const collections = sqliteTable('collections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

export const postTags = sqliteTable(
  'post_tags',
  {
    postId: integer('post_id').references(() => posts.id, { onDelete: 'cascade' }).notNull(),
    tagId: integer('tag_id').references(() => tags.id, { onDelete: 'cascade' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] })],
);

export const comments = sqliteTable('comments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  postId: integer('post_id').references(() => posts.id, { onDelete: 'cascade' }).notNull(),
  author: text('author').notNull(),
  email: text('email').notNull().default(''),
  website: text('website').notNull().default(''),
  content: text('content').notNull(),
  ip: text('ip').notNull().default(''),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
  parentId: integer('parent_id'),
  /** 邮件订阅：该评论被回复时通知作者（需留邮箱，1=订阅） */
  notify: integer('notify').notNull().default(0),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

export const talks = sqliteTable('talks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  content: text('content').notNull(),
  ip: text('ip').notNull().default(''),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

export const friendLinks = sqliteTable('friend_links', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  url: text('url').notNull(),
  description: text('description').notNull().default(''),
  avatar: text('avatar').notNull().default(''),
  rss: text('rss').notNull().default(''),
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

export const photos = sqliteTable('photos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  url: text('url').notNull(),
  title: text('title').notNull().default(''),
  description: text('description').notNull().default(''),
  album: text('album').notNull().default(''),
  /** 拍摄参数 EXIF 摘要（JSON：机型/光圈/快门/焦距/ISO/时间），上传时浏览器端解析 */
  exif: text('exif').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

// 访问统计：daily_stats 按天计浏览量；visit_log 记录当日独立 IP（主键去重）算访客数
export const dailyStats = sqliteTable('daily_stats', {
  day: text('day').primaryKey(),
  views: integer('views').notNull().default(0),
});
export const visitLog = sqliteTable(
  'visit_log',
  {
    day: text('day').notNull(),
    ip: text('ip').notNull(),
  },
  (t) => [primaryKey({ columns: [t.day, t.ip] })],
);

// 后台操作审计日志（登录后台的写操作：谁、何时、做了什么）
export const adminLogs = sqliteTable('admin_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull(),
  method: text('method').notNull(),
  path: text('path').notNull(),
  status: integer('status').notNull(),
  ip: text('ip').notNull().default(''),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});
