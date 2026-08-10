import { describe, it, expect, vi } from 'vitest';
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

describe('GitHub 项目接口 /api/projects', () => {
  function reposFixture() {
    return [
      { name: 'a', description: 'A', html_url: 'https://github.com/u/a', language: 'TS', stargazers_count: 5, updated_at: '2026-01-01T00:00:00Z', fork: false },
      { name: 'forked', description: '', html_url: 'x', language: null, stargazers_count: 99, updated_at: '2026-02-01T00:00:00Z', fork: true },
      { name: 'b', description: 'B', html_url: 'https://github.com/u/b', language: 'Rust', stargazers_count: 3, updated_at: '2026-03-01T00:00:00Z', fork: false },
    ];
  }
  async function enableGitHub(app: ReturnType<typeof makeTestApp>['app'], username = 'octocat') {
    const token = await loginAsAdmin(app);
    const put = await app.request('/api/admin/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify({ github_enabled: '1', github_username: username }),
    });
    expect(put.status).toBe(200);
  }

  it('未开启时返回 enabled:false', async () => {
    const { app } = makeTestApp();
    const res = await app.request('/api/projects');
    const body = (await res.json()) as { data: { enabled: boolean } };
    expect(body.data.enabled).toBe(false);
  });

  it('拉取仓库：过滤 fork、按星数降序', async () => {
    const { app } = makeTestApp();
    await enableGitHub(app);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => reposFixture() });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res = await app.request('/api/projects');
      const body = (await res.json()) as { data: { enabled: boolean; projects: { name: string; stars: number }[] } };
      expect(body.data.enabled).toBe(true);
      expect(body.data.projects.map((p) => p.name)).toEqual(['a', 'b']);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('缓存生效：TTL 内第二次请求不再调用 fetch', async () => {
    const { app } = makeTestApp();
    await enableGitHub(app);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => reposFixture() });
    vi.stubGlobal('fetch', fetchMock);
    try {
      await app.request('/api/projects');
      await app.request('/api/projects');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('拉取失败返回 error 提示', async () => {
    const { app } = makeTestApp();
    await enableGitHub(app);
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res = await app.request('/api/projects');
      const body = (await res.json()) as { data: { error: string; projects: unknown[] } };
      expect(body.data.error).toBeTruthy();
      expect(body.data.projects).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
