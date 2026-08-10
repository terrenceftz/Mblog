import { expect } from 'vitest';
import { createApp } from '../src/app';
import { createDb } from '../src/db';
import { ensureMigrated } from '../src/db/migrate';
import { resetRateLimit } from '../src/middleware/rateLimit';

export function makeTestApp() {
  resetRateLimit(); // 隔离限流桶状态
  const ctx = createDb(':memory:');
  ensureMigrated(ctx);
  const app = createApp(ctx);
  return { app, ctx };
}

export async function loginAsAdmin(app: ReturnType<typeof createApp>): Promise<string> {
  const res = await app.request('/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  expect(res.status).toBe(200); // 登录失败（如误触限流）立即暴露，避免下游难排查
  const body = (await res.json()) as { data: { token: string } };
  return body.data.token;
}

export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
