import type { Context, Next } from 'hono';

const buckets = new Map<string, { count: number; resetAt: number }>();

/** 基于 IP 的简单限流（内存版，单实例够用）。 */
export function rateLimit(max: number, windowMs: number) {
  return async (c: Context, next: Next) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('x-real-ip') ??
      'unknown';
    const now = Date.now();
    const bucket = buckets.get(ip);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(ip, { count: 1, resetAt: now + windowMs });
    } else if (bucket.count >= max) {
      return c.json({ error: { code: 'RATE_LIMITED', message: '操作过于频繁，请稍后再试' } }, 429);
    } else {
      bucket.count += 1;
    }
    await next();
  };
}

/** 仅测试用：清空限流桶，避免跨用例共享状态导致误 429。 */
export function resetRateLimit(): void {
  buckets.clear();
}
