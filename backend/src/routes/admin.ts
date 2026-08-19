import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { auditLogger } from '../middleware/audit';
import { authRoutes } from './admin/auth';
import { categoriesAdminRoutes } from './admin/categories';
import { collectionsAdminRoutes } from './admin/collections';
import { tagsAdminRoutes } from './admin/tags';
import { postsAdminRoutes } from './admin/posts';
import { commentsAdminRoutes } from './admin/comments';
import { friendLinksAdminRoutes } from './admin/friendLinks';
import { uploadAdminRoutes } from './admin/upload';
import { settingsAdminRoutes } from './admin/settings';
import { doubanAdminRoutes } from './admin/douban';
import { talksAdminRoutes } from './admin/talks';
import { photosAdminRoutes } from './admin/photos';
import { neteaseAdminRoutes } from './admin/netease';
import { auditLogsAdminRoutes } from './admin/auditLogs';
import { backupAdminRoutes } from './admin/backup';
import { exportAdminRoutes } from './admin/export';
import type { Db } from '../db';

export function adminRoutes(ctx: Db) {
  const app = new Hono();
  app.route('/', authRoutes(ctx));
  app.use('*', authMiddleware);
  // 审计日志挂在鉴权之后：记录所有通过鉴权的写操作
  app.use('*', auditLogger(ctx));
  app.route('/', categoriesAdminRoutes(ctx));
  app.route('/', collectionsAdminRoutes(ctx));
  app.route('/', tagsAdminRoutes(ctx));
  app.route('/', postsAdminRoutes(ctx));
  app.route('/', commentsAdminRoutes(ctx));
  app.route('/', friendLinksAdminRoutes(ctx));
  app.route('/', uploadAdminRoutes(ctx));
  app.route('/', settingsAdminRoutes(ctx));
  app.route('/', doubanAdminRoutes(ctx));
  app.route('/', talksAdminRoutes(ctx));
  app.route('/', photosAdminRoutes(ctx));
  app.route('/', neteaseAdminRoutes(ctx));
  app.route('/', auditLogsAdminRoutes(ctx));
  app.route('/', backupAdminRoutes(ctx));
  app.route('/', exportAdminRoutes(ctx));
  return app;
}
