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

  // 增量列迁移：早期库无 website 列时补充（幂等）
  const hasWebsite = (ctx.sqlite.prepare('PRAGMA table_info(comments)').all() as { name: string }[]).some(
    (c) => c.name === 'website',
  );
  if (!hasWebsite) {
    ctx.sqlite.exec(`ALTER TABLE comments ADD COLUMN website text NOT NULL DEFAULT ''`);
  }

  // 增量列迁移：点赞数
  const hasLike = (ctx.sqlite.prepare('PRAGMA table_info(posts)').all() as { name: string }[]).some(
    (c) => c.name === 'like_count',
  );
  if (!hasLike) {
    ctx.sqlite.exec(`ALTER TABLE posts ADD COLUMN like_count integer NOT NULL DEFAULT 0`);
  }

  // 增量列迁移：分类特色图（后台可配，前台分类页卡片背景）
  const hasCatCover = (ctx.sqlite.prepare('PRAGMA table_info(categories)').all() as { name: string }[]).some(
    (c) => c.name === 'cover',
  );
  if (!hasCatCover) {
    ctx.sqlite.exec(`ALTER TABLE categories ADD COLUMN cover text NOT NULL DEFAULT ''`);
  }

  // 说说表（访客留言/短动态）
  ctx.sqlite.exec(`
    CREATE TABLE IF NOT EXISTS talks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      ip TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
      created_at INTEGER NOT NULL
    );
  `);

  // 相册表（简约相册：url + 标题/描述 + 分组 + 排序）
  ctx.sqlite.exec(`
    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      album TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
  `);

  // 增量列迁移：相册分组（老库补列；新库建表语句已含）
  const hasAlbum = (ctx.sqlite.prepare('PRAGMA table_info(photos)').all() as { name: string }[]).some(
    (c) => c.name === 'album',
  );
  if (!hasAlbum) {
    ctx.sqlite.exec(`ALTER TABLE photos ADD COLUMN album text NOT NULL DEFAULT ''`);
  }

  // 增量列迁移：照片 EXIF 摘要（JSON）
  const hasExif = (ctx.sqlite.prepare('PRAGMA table_info(photos)').all() as { name: string }[]).some(
    (c) => c.name === 'exif',
  );
  if (!hasExif) {
    ctx.sqlite.exec(`ALTER TABLE photos ADD COLUMN exif text NOT NULL DEFAULT ''`);
  }

  // 增量列迁移：评论邮件订阅（被回复时通知评论者）
  const hasNotify = (ctx.sqlite.prepare('PRAGMA table_info(comments)').all() as { name: string }[]).some(
    (c) => c.name === 'notify',
  );
  if (!hasNotify) {
    ctx.sqlite.exec(`ALTER TABLE comments ADD COLUMN notify integer NOT NULL DEFAULT 0`);
  }

  // 合集/专栏表（系列文章）
  ctx.sqlite.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
  `);

  // 增量列迁移：文章所属合集（可空，删合集置空）
  const hasCollection = (ctx.sqlite.prepare('PRAGMA table_info(posts)').all() as { name: string }[]).some(
    (c) => c.name === 'collection_id',
  );
  if (!hasCollection) {
    ctx.sqlite.exec(`ALTER TABLE posts ADD COLUMN collection_id integer`);
  }

  // 访问统计：按天浏览量 + 当日独立 IP 去重表
  ctx.sqlite.exec(`
    CREATE TABLE IF NOT EXISTS daily_stats (
      day TEXT PRIMARY KEY,
      views INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS visit_log (
      day TEXT NOT NULL,
      ip TEXT NOT NULL,
      PRIMARY KEY (day, ip)
    );
  `);

  // 后台操作审计日志表
  ctx.sqlite.exec(`
    CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      status INTEGER NOT NULL,
      ip TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
  `);

  // 常用查询索引（SQLite 外键不会自动建索引；数据量上来后评论/标签/分类过滤会退化）
  // 幂等，直接执行不报错
  ctx.sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
    CREATE INDEX IF NOT EXISTS idx_post_tags_post_id ON post_tags(post_id);
    CREATE INDEX IF NOT EXISTS idx_post_tags_tag_id ON post_tags(tag_id);
    CREATE INDEX IF NOT EXISTS idx_posts_category_status_created ON posts(category_id, status, created_at);
    CREATE INDEX IF NOT EXISTS idx_posts_collection ON posts(collection_id);
    CREATE INDEX IF NOT EXISTS idx_talks_created_at ON talks(created_at);
    CREATE INDEX IF NOT EXISTS idx_friend_links_status ON friend_links(status);
    CREATE INDEX IF NOT EXISTS idx_photos_sort_created ON photos(sort_order, created_at);
    CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at);
  `);

  const existing = ctx.db.select({ id: users.id }).from(users).limit(1).get();
  if (existing) return;

  const isProduction = process.env.NODE_ENV === 'production';
  const username = process.env.ADMIN_USERNAME ?? 'admin';
  const providedPassword = process.env.ADMIN_PASSWORD;

  if (isProduction && !providedPassword) {
    throw new Error('生产环境必须通过 ADMIN_PASSWORD 环境变量设置初始管理员密码');
  }
  if (providedPassword && providedPassword.length < 8) {
    throw new Error('ADMIN_PASSWORD 长度不足 8 位');
  }
  const password = providedPassword ?? 'admin123';
  if (!providedPassword) {
    console.warn(
      '[init] 未设置 ADMIN_PASSWORD，使用默认密码 admin/admin123。请立即通过环境变量设置强密码并调用改密接口更换。',
    );
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  ctx.db.insert(users).values({ username, passwordHash }).run();
  console.log(`[init] 已创建管理员账号: ${username}`);
}
