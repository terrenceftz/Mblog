import { mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Db } from '../db';

/**
 * 在线备份 SQLite（better-sqlite3 的 backup API，WAL 模式下安全，无需停机）。
 * 备份文件写入 BACKUP_DIR（默认 backend/backups/），返回文件名与字节数。
 * 注意：better-sqlite3 v12 的 backup() 是异步 API（返回 Promise），必须 await。
 */
export async function runBackup(ctx: Db): Promise<{ file: string; size: number }> {
  const dir = path.resolve(process.env.BACKUP_DIR ?? 'backups');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `mblog-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
  await ctx.sqlite.backup(file);
  const size = statSync(file).size;
  return { file: path.basename(file), size };
}
