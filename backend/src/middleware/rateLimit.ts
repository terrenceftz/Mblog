import type { Context, Next } from 'hono';
import { clientIp } from '../lib/clientIp';

const buckets = new Map<string, { count: number; resetAt: number }>();

/** 基于 IP 的简单限流（内存版，单实例够用）。 */
export function rateLimit(max: number, windowMs: number) {
  return async (c: Context, next: Next) => {
    // 拿不到远端地址时退化为单桶，避免伪装头绕过限流
    const ip = clientIp(c) ?? 'local';
    const now = Date.now();
    const bucket = buckets.get(ip);
    if (!bucket) {
      buckets.set(ip, { count: 1, resetAt: now + windowMs });
    } else if (bucket.resetAt <= now) {
      buckets.delete(ip); // 惰性驱逐过期桶，防无限增长
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
