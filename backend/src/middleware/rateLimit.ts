import type { Context, Next } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';

const buckets = new Map<string, { count: number; resetAt: number }>();

function trustProxy(): boolean {
  const v = process.env.TRUST_PROXY;
  return v === '1' || v === 'true' || v === 'TRUE';
}

/** 解析客户端真实 IP：仅当显式配置 TRUST_PROXY 时才信任反向代理注入的头。 */
function clientIp(c: Context): string {
  if (trustProxy()) {
    // x-real-ip（Nginx 设置为真实远端 IP）；XFF 取最右侧（由可信代理追加）
    const realIp = c.req.header('x-real-ip')?.trim();
    if (realIp) return realIp;
    const forwarded = c.req.header('x-forwarded-for')?.split(',').pop()?.trim();
    if (forwarded) return forwarded;
  }
  try {
    const address = getConnInfo(c).remote.address;
    if (address) return address;
  } catch {
    // 测试环境（app.request）或适配器未提供连接信息时忽略
  }
  // 拿不到远端地址时退化为单桶，避免伪装头绕过限流
  return 'local';
}

/** 基于 IP 的简单限流（内存版，单实例够用）。 */
export function rateLimit(max: number, windowMs: number) {
  return async (c: Context, next: Next) => {
    const ip = clientIp(c);
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
