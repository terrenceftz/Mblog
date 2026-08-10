import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

// 状态码 → 业务错误码映射，保持统一错误词汇表
const STATUS_CODES: Record<number, string> = {
  400: 'INVALID',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
};

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    const code = STATUS_CODES[err.status] ?? 'HTTP_ERROR';
    return c.json({ error: { code, message: err.message } }, err.status);
  }
  if (err instanceof SyntaxError) {
    // 客户端请求体 JSON 解析失败等输入错误
    return c.json({ error: { code: 'INVALID', message: '请求格式错误' } }, 400);
  }
  console.error('[error]', c.req.method, c.req.path, err);
  return c.json({ error: { code: 'INTERNAL', message: '服务器内部错误' } }, 500);
};
