import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { verifyToken } from '../lib/jwt';

export async function authMiddleware(c: Context, next: Next) {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: '未登录' });
  }
  try {
    const user = await verifyToken(header.slice(7));
    c.set('user', user);
    await next();
  } catch {
    throw new HTTPException(401, { message: '登录已过期或无效' });
  }
}
