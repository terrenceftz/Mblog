#!/usr/bin/env node
// 独立数据库备份脚本（可在服务器上 cron 定时执行）：
//   node scripts/backup.mjs
// 环境变量：DB_PATH（默认 data/mblog.db）· BACKUP_DIR（默认 backups/）· BACKUP_KEEP（默认 20 份）
// 用 better-sqlite3 的 backup API 在线备份，WAL 模式下安全、无需停机。
import Database from 'better-sqlite3';
import { mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';

const dbPath = process.env.DB_PATH ?? 'data/mblog.db';
const backupDir = path.resolve(process.env.BACKUP_DIR ?? 'backups');
const keep = Number(process.env.BACKUP_KEEP) || 20;
mkdirSync(backupDir, { recursive: true });

const out = path.join(backupDir, `mblog-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
const db = new Database(dbPath);
try {
  await db.backup(out);
} finally {
  db.close();
}
console.log(`[backup] ${dbPath} -> ${out}`);

// 保留策略：超出 KEEP 份删除最旧
try {
  const backups = readdirSync(backupDir).filter((f) => /^mblog-.*\.db$/.test(f)).sort();
  for (const old of backups.slice(0, Math.max(0, backups.length - keep))) {
    unlinkSync(path.join(backupDir, old));
    console.log(`[backup] 清理旧备份: ${old}`);
  }
} catch {
  /* 清理失败不退出非零，备份本身已成功 */
}
