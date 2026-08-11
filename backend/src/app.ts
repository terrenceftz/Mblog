import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { errorHandler } from './middleware/error';
import { publicRoutes } from './routes/public';
import { adminRoutes } from './routes/admin';
import type { Db } from './db';

export function createApp(ctx: Db) {
  const app = new Hono();
  app.onError(errorHandler);

  // 未匹配路由统一返回 JSON 错误
  app.notFound((c) =>
    c.json({ error: { code: 'NOT_FOUND', message: '接口不存在' } }, 404),
  );

  // 所有响应统一加 nosniff，防止浏览器嗅探为可执行内容
  app.use(async (c, next) => {
    c.header('X-Content-Type-Options', 'nosniff');
    await next();
  });

  app.get('/api/health', (c) => c.json({ data: { status: 'ok' } }));

  // 开发环境：本地存储的文件由后端直接静态服务；生产由 Nginx 服务
  app.use('/uploads/*', serveStatic({ root: './' }));

  app.route('/api', publicRoutes(ctx));
  app.route('/api/admin', adminRoutes(ctx));
  return app;
}
