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

  // 安全响应头（所有响应统一，含错误页）
  app.use(async (c, next) => {
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY'); // 防点击劫持
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // HSTS 仅 HTTPS 请求下发（生产走 nginx 反代并透传 x-forwarded-proto；本地 http 不发避免影响 localhost 调试）
    if (c.req.header('x-forwarded-proto') === 'https') {
      c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    await next();
  });

  app.get('/api/health', (c) => c.json({ data: { status: 'ok' } }));

  // 开发环境：本地存储的文件由后端直接静态服务；生产由 Nginx 服务
  app.use('/uploads/*', serveStatic({ root: './' }));

  app.route('/api', publicRoutes(ctx));
  app.route('/api/admin', adminRoutes(ctx));
  return app;
}
