import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { errorHandler } from './middleware/error';
import { publicRoutes } from './routes/public';
import { adminRoutes } from './routes/admin';
import type { Db } from './db';

export function createApp(ctx: Db) {
  const app = new Hono();
  app.onError(errorHandler);

  app.get('/api/health', (c) => c.json({ data: { status: 'ok' } }));

  // 开发环境：本地存储的文件由后端直接静态服务；生产由 Nginx 服务
  app.use('/uploads/*', serveStatic({ root: './' }));

  app.route('/api', publicRoutes(ctx));
  app.route('/api/admin', adminRoutes(ctx));
  return app;
}
