import { beforeEach } from 'vitest';
import { resetRateLimit } from '../src/middleware/rateLimit';
import { resetDoubanCache } from '../src/routes/public/douban';

beforeEach(() => {
  resetRateLimit();
  resetDoubanCache();
});
