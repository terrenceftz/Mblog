import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { users } from '../../db/schema';
import { signToken } from '../../lib/jwt';
import { authMiddleware } from '../../middleware/auth';
import { rateLimit } from '../../middleware/rateLimit';
import { clientIp } from '../../lib/clientIp';
import type { Db } from '../../db';

// 预计算假哈希：用户不存在时也执行 bcrypt 比较，避免时序泄露用户是否存在
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

// 登录失败锁定：同用户名+IP 连续失败 5 次锁 15 分钟（内存版，单实例够用）
const LOGIN_MAX_FAILS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const locks = new Map<string, { fails: number; lockedUntil: number }>();

/** 仅测试用：清空登录锁定计数。 */
export function resetLoginLock(): void {
  locks.clear();
}

export function authRoutes(ctx: Db) {
  const app = new Hono();

  app.post('/login', rateLimit(5, 60_000), async (c) => {
    const body = await c.req.json().catch(() => null);
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!username || !password) {
      return c.json({ error: { code: 'INVALID', message: '请输入用户名和密码' } }, 400);
    }
    const ip = clientIp(c) ?? 'unknown';
    const lockKey = `${username}|${ip}`;
    const lock = locks.get(lockKey);
    if (lock && lock.lockedUntil > Date.now()) {
      return c.json({ error: { code: 'LOCKED', message: '失败次数过多，账号已锁定 15 分钟' } }, 429);
    }
    const user = ctx.db.select().from(users).where(eq(users.username, username)).get();
    const ok = bcrypt.compareSync(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) {
      const cur = locks.get(lockKey) ?? { fails: 0, lockedUntil: 0 };
      cur.fails += 1;
      if (cur.fails >= LOGIN_MAX_FAILS) {
        cur.lockedUntil = Date.now() + LOGIN_LOCK_MS;
        cur.fails = 0;
      }
      locks.set(lockKey, cur);
      return c.json({ error: { code: 'UNAUTHORIZED', message: '用户名或密码错误' } }, 401);
    }
    locks.delete(lockKey); // 成功登录清零失败计数
    const token = await signToken({ username: user.username });
    return c.json({ data: { token } });
  });

  // authRoutes 挂载在全局鉴权中间件之前，故此处按路由单独启用鉴权
  app.post('/password', authMiddleware, async (c) => {
    const body = await c.req.json().catch(() => null);
    const oldPassword = typeof body?.oldPassword === 'string' ? body.oldPassword : '';
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
    if (!oldPassword || !newPassword) {
      return c.json({ error: { code: 'INVALID', message: '请输入原密码和新密码' } }, 400);
    }
    if (newPassword.length < 8) {
      return c.json({ error: { code: 'WEAK_PASSWORD', message: '新密码长度不能少于 8 位' } }, 400);
    }
    const user = c.get('user') as { username: string };
    const row = ctx.db.select().from(users).where(eq(users.username, user.username)).get();
    if (!row) return c.json({ error: { code: 'NOT_FOUND', message: '用户不存在' } }, 404);
    if (!bcrypt.compareSync(oldPassword, row.passwordHash)) {
      return c.json({ error: { code: 'INVALID_PASSWORD', message: '原密码错误' } }, 401);
    }
    const passwordHash = bcrypt.hashSync(newPassword, 10);
    ctx.db.update(users).set({ passwordHash }).where(eq(users.id, row.id)).run();
    return c.json({ data: { message: '密码已更新' } });
  });

  return app;
}
