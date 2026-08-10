import { beforeEach } from 'vitest';
import { resetRateLimit } from '../src/middleware/rateLimit';

beforeEach(() => {
  resetRateLimit();
});
