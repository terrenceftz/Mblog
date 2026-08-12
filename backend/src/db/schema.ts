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
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
  status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
  viewCount: integer('view_count').notNull().default(0),
  likeCount: integer('like_count').notNull().default(0),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
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
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});
