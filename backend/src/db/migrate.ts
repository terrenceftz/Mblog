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
