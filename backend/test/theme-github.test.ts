import { describe, it, expect } from 'vitest';
import { makeTestApp, loginAsAdmin, authHeaders } from './helpers';
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

describe('主题配置持久化与公开返回', () => {
  it('保存主题配置后 /api/settings/public 返回解析结果', async () => {
    const { app } = makeTestApp();
    const token = await loginAsAdmin(app);
    const payload = JSON.stringify({
      theme_reader: JSON.stringify({ bg: '#f3f0e9', fontSize: 18, homePageSize: 3 }),
      github_username: 'octocat',
      github_enabled: '1',
    });
    const put = await app.request('/api/admin/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...authHeaders(token) },
      body: payload,
    });
    expect(put.status).toBe(200);

    const pub = await app.request('/api/settings/public');
    expect(pub.status).toBe(200);
    const body = (await pub.json()) as {
      data: { themeReader: Record<string, unknown>; themeNormal: Record<string, unknown>; githubUsername: string; githubEnabled: boolean };
    };
    expect(body.data.themeReader).toEqual({ bg: '#f3f0e9', fontSize: 18, homePageSize: 3 });
    expect(body.data.themeNormal).toEqual({});
    expect(body.data.githubUsername).toBe('octocat');
    expect(body.data.githubEnabled).toBe(true);
  });

  it('未配置时主题配置返回空对象', async () => {
    const { app } = makeTestApp();
    const pub = await app.request('/api/settings/public');
    const body = (await pub.json()) as { data: { themeReader: Record<string, unknown>; githubEnabled: boolean } };
    expect(body.data.themeReader).toEqual({});
    expect(body.data.githubEnabled).toBe(false);
  });
});
