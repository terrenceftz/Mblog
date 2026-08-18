import { describe, it, expect, vi } from 'vitest';
import { makeTestApp } from './helpers';

describe('security headers', () => {
  const { app } = makeTestApp();

  it('所有响应带基础安全头，未走 https 代理时不下发 HSTS', async () => {
    const res = await app.request('/api/health');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('permissions-policy')).toContain('camera=()');
    expect(res.headers.get('strict-transport-security')).toBeNull();
  });

  it('x-forwarded-proto: https 时下发 HSTS', async () => {
    const res = await app.request('/api/health', { headers: { 'x-forwarded-proto': 'https' } });
    expect(res.headers.get('strict-transport-security')).toContain('max-age=31536000');
  });
});

describe('login lockout', () => {
  const { app } = makeTestApp();

  it('连续 5 次密码错误后锁定账号（锁定期内密码正确也拒绝）', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await app.request('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'wrong' }),
      });
      expect(res.status).toBe(401);
    }
    // 用假时钟越过限流窗口（60s），让请求能到达锁定检查
    vi.useFakeTimers();
    vi.advanceTimersByTime(61_000);
    const res = await app.request('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    vi.useRealTimers();
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe('LOCKED');
  });
});
