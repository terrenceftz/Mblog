#!/usr/bin/env node
// 独立数据库备份脚本（可在服务器上 cron 定时执行）：
//   node scripts/backup.mjs
// 环境变量：DB_PATH（默认 data/mblog.db）· BACKUP_DIR（默认 backups/）
// 用 better-sqlite3 的 backup API 在线备份，WAL 模式下安全、无需停机。
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const dbPath = process.env.DB_PATH ?? 'data/mblog.db';
const backupDir = path.resolve(process.env.BACKUP_DIR ?? 'backups');
mkdirSync(backupDir, { recursive: true });

const out = path.join(backupDir, `mblog-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
const db = new Database(dbPath);
try {
  await db.backup(out);
} finally {
  db.close();
}
console.log(`[backup] ${dbPath} -> ${out}`);
