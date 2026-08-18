// 测试环境的 JWT 密钥（≥32 位，避免服务层 fail-fast 校验拦截）
process.env.JWT_SECRET = 'test-secret-0123456789abcdef0123456789abcdef';

import { beforeEach } from 'vitest';
import { resetRateLimit } from '../src/middleware/rateLimit';
import { resetLoginLock } from '../src/routes/admin/auth';
import { resetDoubanCache } from '../src/routes/public/douban';
import { resetCaptchas } from '../src/lib/captcha';

beforeEach(() => {
  resetRateLimit();
  resetLoginLock();
  resetDoubanCache();
  resetCaptchas();
});
