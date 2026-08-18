import type { Context, Next } from 'hono';
import { adminLogs } from '../db/schema';
import { clientIp } from '../lib/clientIp';
import type { Db } from '../db';

// 只记录写操作（GET 列表查询不构成"操作"，避免日志噪声）
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * 后台操作审计：记录所有通过鉴权的写操作（方法/路径/状态码/IP）。
 * 必须在 authMiddleware 之后挂载（依赖 c.get('user')）。
 * 404（路由不存在）不记录；失败响应（4xx/5xx）照常记录以便回溯误操作。
 */
export function auditLogger(ctx: Db) {
  return async (c: Context, next: Next) => {
    const method = c.req.method;
    if (!MUTATING.has(method)) return next();
    await next(); // 先放行拿到响应状态码
    const status = c.res.status;
    if (status === 404) return;
    try {
      const user = c.get('user') as { username: string } | undefined;
      ctx.db
        .insert(adminLogs)
        .values({
          username: user?.username ?? 'unknown',
          method,
          path: new URL(c.req.url).pathname,
          status,
          ip: clientIp(c) ?? '',
        })
        .run();
    } catch {
      // 审计写失败不影响主流程（记录丢失可接受）
    }
  };
}
