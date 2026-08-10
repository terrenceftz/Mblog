import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { users } from '../../db/schema';
import { signToken } from '../../lib/jwt';
import type { Db } from '../../db';

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
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: '用户名或密码错误' } }, 401);
    }
    const token = await signToken({ username: user.username });
    return c.json({ data: { token } });
  });

  return app;
}
