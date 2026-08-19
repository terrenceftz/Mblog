import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export type Db = ReturnType<typeof createDb>;

export function createDb(path: string) {
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL'); // WAL 推荐档：仅 checkpoint 落盘 fsync，写吞吐明显提升（断电最多丢最后事务，博客可接受）
  sqlite.pragma('foreign_keys = ON'); // 显式启用外键级联
  sqlite.pragma('busy_timeout = 5000'); // 并发写锁等待 5s，避免 SQLITE_BUSY 偶发失败
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}
