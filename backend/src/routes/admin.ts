import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { authRoutes } from './admin/auth';
import type { Db } from '../db';

export function adminRoutes(ctx: Db) {
  const app = new Hono();
  app.route('/', authRoutes(ctx));
  app.use('*', authMiddleware);
  // 后续管理子路由在此挂载（需登录）
  return app;
}
