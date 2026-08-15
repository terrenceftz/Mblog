import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { authRoutes } from './admin/auth';
import { categoriesAdminRoutes } from './admin/categories';
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
import type { Db } from '../db';

export function adminRoutes(ctx: Db) {
  const app = new Hono();
  app.route('/', authRoutes(ctx));
  app.use('*', authMiddleware);
  app.route('/', categoriesAdminRoutes(ctx));
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
  return app;
}
