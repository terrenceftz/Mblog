import { randomInt } from 'node:crypto';

/**
 * 极简数学验证码（防机器人评论）
 * - 服务端生成两数加法题，存入内存 Map，5 分钟过期、一次性使用
 * - 单实例内存版即可（与限流同思路，多实例需换共享存储）
 */

interface CaptchaEntry {
  answer: number;
  expiresAt: number;
}

const store = new Map<string, CaptchaEntry>();
const TTL_MS = 5 * 60 * 1000;
const MAX = 50;

/** 清理过期与超限条目（惰性 + 超限驱逐） */
function prune(now: number): void {
  if (store.size <= MAX) {
    for (const [id, e] of store) if (e.expiresAt <= now) store.delete(id);
    return;
  }
  // 超过上限时清空全部过期项；若仍超限则整体清空（防内存膨胀）
  for (const [id, e] of store) if (e.expiresAt <= now) store.delete(id);
  if (store.size > MAX) store.clear();
}

/** 生成一个新验证码题，返回 id 与展示文本（形如 "3 + 8 = ?"） */
export function createCaptcha(): { id: string; question: string } {
  prune(Date.now());
  const a = randomInt(1, 21);
  const b = randomInt(1, 21);
  const id = randomInt(1_000_000, 2_000_000_000).toString(36);
  store.set(id, { answer: a + b, expiresAt: Date.now() + TTL_MS });
  return { id, question: `${a} + ${b} = ?` };
}

/** 校验答案：存在、未过期、答案正确 → 通过并一次性消费 */
export function verifyCaptcha(id: unknown, answer: unknown): boolean {
  if (typeof id !== 'string' || typeof answer !== 'string') return false;
  const entry = store.get(id);
  if (!entry || entry.expiresAt <= Date.now()) {
    store.delete(String(id));
    return false;
  }
  store.delete(id);
  return String(entry.answer) === answer.trim();
}

/** 仅测试用：清空验证码，避免跨用例干扰 */
export function resetCaptchas(): void {
  store.clear();
}
