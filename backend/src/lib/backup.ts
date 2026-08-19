import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import type { Db } from '../db';

const KEEP_DEFAULT = 20;

/**
 * 在线备份 SQLite（better-sqlite3 的 backup API，WAL 模式下安全，无需停机）。
 * 备份文件写入 BACKUP_DIR（默认 backend/backups/），返回文件名与字节数。
 * 注意：better-sqlite3 v12 的 backup() 是异步 API（返回 Promise），必须 await。
 * 保留策略：BACKUP_KEEP（默认 20）份，超出删除最旧的，防目录无限增长。
 */
export async function runBackup(ctx: Db): Promise<{ file: string; size: number }> {
  const dir = path.resolve(process.env.BACKUP_DIR ?? 'backups');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `mblog-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
  await ctx.sqlite.backup(file);
  const size = statSync(file).size;
  pruneBackups(dir);
  return { file: path.basename(file), size };
}

/** 只保留最近 KEEP 份备份（按文件名时间戳排序，新备份名天然可排序）。 */
export function pruneBackups(dir: string, keep = Number(process.env.BACKUP_KEEP) || KEEP_DEFAULT): void {
  try {
    const backups = readdirSync(dir)
      .filter((f) => /^mblog-.*\.db$/.test(f))
      .sort(); // ISO 时间戳字典序 = 时间序
    for (const old of backups.slice(0, Math.max(0, backups.length - keep))) {
      unlinkSync(path.join(dir, old));
    }
  } catch {
    // 清理失败不影响备份主流程
  }
}
