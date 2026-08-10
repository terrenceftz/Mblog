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
