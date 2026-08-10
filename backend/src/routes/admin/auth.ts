import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { users } from '../../db/schema';
import { signToken } from '../../lib/jwt';
import type { Db } from '../../db';

// 预计算假哈希：用户不存在时也执行 bcrypt 比较，避免时序泄露用户是否存在
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

export function authRoutes(ctx: Db) {
  const app = new Hono();

  app.post('/login', async (c) => {
    const body = await c.req.json().catch(() => null);
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!username || !password) {
      return c.json({ error: { code: 'INVALID', message: '请输入用户名和密码' } }, 400);
    }
    const user = ctx.db.select().from(users).where(eq(users.username, username)).get();
    const ok = bcrypt.compareSync(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: '用户名或密码错误' } }, 401);
    }
    const token = await signToken({ username: user.username });
    return c.json({ data: { token } });
  });

  return app;
}
