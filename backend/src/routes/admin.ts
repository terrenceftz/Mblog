import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { authRoutes } from './admin/auth';
import { categoriesAdminRoutes } from './admin/categories';
import { tagsAdminRoutes } from './admin/tags';
import { postsAdminRoutes } from './admin/posts';
import type { Db } from '../db';

export function adminRoutes(ctx: Db) {
  const app = new Hono();
  app.route('/', authRoutes(ctx));
  app.use('*', authMiddleware);
  app.route('/', categoriesAdminRoutes(ctx));
  app.route('/', tagsAdminRoutes(ctx));
  app.route('/', postsAdminRoutes(ctx));
  return app;
}
