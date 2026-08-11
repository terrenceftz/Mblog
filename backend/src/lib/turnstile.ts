// Cloudflare Turnstile 服务端校验
// 文档：https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** 校验 Turnstile token；网络异常/校验失败一律返回 false（拒绝放行） */
export async function verifyTurnstile(
  token: string,
  secret: string,
  remoteIp?: string,
): Promise<boolean> {
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);
  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
