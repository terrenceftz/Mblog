import { SignJWT, jwtVerify } from 'jose';

// JWT 密钥最短长度：低于此值一律拒绝启动，避免弱密钥被暴力破解
const MIN_SECRET_LENGTH = 32;

/** 读取并校验 JWT 密钥；缺失或过短时抛错（fail-fast）。 */
export function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error('JWT_SECRET 环境变量未设置或长度不足 32 位，拒绝启动');
  }
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: { username: string }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<{ username: string }> {
  const { payload } = await jwtVerify(token, getSecret());
  return { username: String(payload.username) };
}
