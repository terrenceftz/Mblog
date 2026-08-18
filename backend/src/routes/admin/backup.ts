import { Hono } from 'hono';
import { runBackup } from '../../lib/backup';
import type { Db } from '../../db';

export function backupAdminRoutes(ctx: Db) {
  const app = new Hono();

  // 立即执行一次数据库在线备份（WAL 安全，不阻塞写）
  app.post('/backup', async (c) => {
    const { file, size } = await runBackup(ctx);
    return c.json({ data: { file, size } });
  });

  return app;
}
