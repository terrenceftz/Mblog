import { describe, it, expect } from 'vitest';
import { parseThemeConfig } from '../src/lib/themeConfig';

describe('parseThemeConfig', () => {
  it('解析合法 JSON 并过滤非法值', () => {
    const cfg = parseThemeConfig(
      JSON.stringify({ bg: '#f3f0e9', fontSize: 18, homePageSize: 5, evil: 'x', fontSizeBad: 999, homePageSizeBad: -1 }),
    );
    expect(cfg).toEqual({ bg: '#f3f0e9', fontSize: 18, homePageSize: 5 });
  });

  it('空串 / 非法 JSON / 非对象返回空对象', () => {
    expect(parseThemeConfig('')).toEqual({});
    expect(parseThemeConfig('not-json')).toEqual({});
    expect(parseThemeConfig('"str"')).toEqual({});
  });

  it('边界值：fontSize 12–24、homePageSize 1–50', () => {
    expect(parseThemeConfig(JSON.stringify({ fontSize: 11 }))).toEqual({});
    expect(parseThemeConfig(JSON.stringify({ fontSize: 12 }))).toEqual({ fontSize: 12 });
    expect(parseThemeConfig(JSON.stringify({ fontSize: 24 }))).toEqual({ fontSize: 24 });
    expect(parseThemeConfig(JSON.stringify({ fontSize: 25 }))).toEqual({});
    expect(parseThemeConfig(JSON.stringify({ homePageSize: 1 }))).toEqual({ homePageSize: 1 });
    expect(parseThemeConfig(JSON.stringify({ homePageSize: 50 }))).toEqual({ homePageSize: 50 });
    expect(parseThemeConfig(JSON.stringify({ homePageSize: 51 }))).toEqual({});
  });
});
