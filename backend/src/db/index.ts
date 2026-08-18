import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export type Db = ReturnType<typeof createDb>;

export function createDb(path: string) {
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON'); // 显式启用外键级联
  sqlite.pragma('busy_timeout = 5000'); // 并发写锁等待 5s，避免 SQLITE_BUSY 偶发失败
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}
