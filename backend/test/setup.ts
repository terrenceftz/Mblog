// 测试环境的 JWT 密钥（≥32 位，避免服务层 fail-fast 校验拦截）
process.env.JWT_SECRET = 'test-secret-0123456789abcdef0123456789abcdef';

import { beforeEach } from 'vitest';
import { resetRateLimit } from '../src/middleware/rateLimit';
import { resetDoubanCache } from '../src/routes/public/douban';

beforeEach(() => {
  resetRateLimit();
  resetDoubanCache();
});
