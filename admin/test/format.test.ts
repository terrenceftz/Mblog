import { describe, it, expect } from 'vitest';
import { fmtTime } from '../src/lib/format';

describe('fmtTime', () => {
  it('把时间戳格式化为 YYYY-MM-DD HH:mm', () => {
    // 2026-08-18 09:05（本地时区无关性：直接用 new Date 的本地部件组装）
    const ts = new Date(2026, 7, 18, 9, 5, 0).getTime();
    expect(fmtTime(ts)).toBe('2026-08-18 09:05');
  });

  it('单数月/日/时/分补零', () => {
    const ts = new Date(2026, 0, 3, 8, 7, 0).getTime();
    expect(fmtTime(ts)).toBe('2026-01-03 08:07');
  });
});
