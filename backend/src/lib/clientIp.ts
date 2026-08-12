import type { Context } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';

function trustProxy(): boolean {
  const v = process.env.TRUST_PROXY;
  return v === '1' || v === 'true' || v === 'TRUE';
}

/**
 * 解析客户端真实 IP（限流、评论 IP 记录等共用）。
 * - 仅当 TRUST_PROXY=1 时才信任反向代理注入的 x-real-ip / x-forwarded-for 头，
 *   避免客户端伪造头绕过限流或污染记录。
 * - 否则取 TCP 连接对端地址（getConnInfo），拿不到时返回 null，由调用方决定兜底值。
 */
export function clientIp(c: Context): string | null {
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
  return null;
}
