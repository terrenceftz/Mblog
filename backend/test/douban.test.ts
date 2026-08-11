import { describe, it, expect, vi } from 'vitest';
import { makeTestApp, loginAsAdmin, authHeaders } from './helpers';
import { fetchDoubanMovies } from '../src/routes/public/douban';
import { syncDoubanMovies } from '../src/routes/public/douban';

const SAMPLE_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>测试 的收藏</title>
  <item>
    <title>看过辛德勒的名单</title>
    <link>https://movie.douban.com/subject/1295124/</link>
    <description><![CDATA[
    <table><tr>
    <td width="80px"><a href="https://movie.douban.com/subject/1295124/" title="Schindler's List">
    <img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p492406163.jpg" alt="Schindler's List"></a></td>
    <td><p>推荐: 力荐</p></td></tr></table>
    ]]></description>
    <pubDate>Mon, 29 Aug 2005 00:19:48 GMT</pubDate>
  </item>
  <item>
    <title>看过星际穿越</title>
    <link>https://movie.douban.com/subject/1889243/</link>
    <description><![CDATA[<p>推荐: 推荐</p>]]></description>
    <pubDate>Tue, 30 Aug 2005 00:00:00 GMT</pubDate>
  </item>
  <item>
    <title>想看沙丘</title>
    <link>https://movie.douban.com/subject/26891333/</link>
    <description><![CDATA[]]></description>
    <pubDate>Wed, 31 Aug 2005 00:00:00 GMT</pubDate>
  </item>
  <item>
    <title>读过百年孤独</title>
    <link>https://book.douban.com/subject/1008145/</link>
    <description><![CDATA[<p>推荐: 还行</p>]]></description>
    <pubDate>Thu, 01 Sep 2005 00:00:00 GMT</pubDate>
  </item>
</channel>
</rss>`;

describe('fetchDoubanMovies', () => {
  it('仅保留电影 + 看过，映射评分与日期，封面解析', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => SAMPLE_FEED });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const movies = await fetchDoubanMovies('1017197');
      expect(movies).toHaveLength(2);
      expect(movies[0]).toEqual({
        title: '辛德勒的名单',
        altTitle: "Schindler's List",
        url: 'https://movie.douban.com/subject/1295124/',
        cover: 'https://img3.doubanio.com/view/photo/s_ratio_poster/public/p492406163.jpg',
        rating: 5,
        ratingText: '力荐',
        date: '2005-08-29',
      });
      expect(movies[1].rating).toBe(4);
      expect(movies[1].ratingText).toBe('推荐');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('拉取非 200 抛错', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);
    try {
      await expect(fetchDoubanMovies('x')).rejects.toThrow('Douban feed 403');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// 开启豆瓣影音：仅设置 douban 字段，不设置 tmdb_api_key（保持旧测试「无 key 不调 TMDB」语义）
async function enableDouban(app: ReturnType<typeof makeTestApp>['app'], uid = '1017197') {
  const token = await loginAsAdmin(app);
  const put = await app.request('/api/admin/settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ douban_enabled: '1', douban_uid: uid }),
  });
  expect(put.status).toBe(200);
}

describe('豆瓣接口 /api/douban', () => {
  it('未开启时返回 enabled:false', async () => {
    const { app } = makeTestApp();
    const res = await app.request('/api/douban');
    const body = (await res.json()) as { data: { enabled: boolean } };
    expect(body.data.enabled).toBe(false);
  });

  it('拉取成功返回电影列表，TTL 内缓存不重复请求', async () => {
    const { app } = makeTestApp();
    await enableDouban(app);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => SAMPLE_FEED });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res1 = await app.request('/api/douban');
      const body1 = (await res1.json()) as { data: { enabled: boolean; movies: { title: string }[] } };
      expect(body1.data.enabled).toBe(true);
      expect(body1.data.movies.map((m) => m.title)).toEqual(['辛德勒的名单', '星际穿越']);
      await app.request('/api/douban');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('拉取失败返回 error 提示', async () => {
    const { app } = makeTestApp();
    await enableDouban(app);
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res = await app.request('/api/douban');
      const body = (await res.json()) as { data: { error: string; movies: unknown[] } };
      expect(body.data.error).toBeTruthy();
      expect(body.data.movies).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('TMDB 海报', () => {
  it('有 key 时逐部搜索 TMDB 并替换封面', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => SAMPLE_FEED })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ poster_path: '/a.jpg' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ poster_path: null }] }) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const movies = await syncDoubanMovies('1017197', 'testkey');
      expect(movies).toHaveLength(2);
      expect(movies[0].cover).toBe('https://image.tmdb.org/t/p/w500/a.jpg');
      expect(movies[1].cover).toBe(''); // 无 poster_path → 回退原封面（示例 feed 封面为空）
      expect(fetchMock).toHaveBeenCalledTimes(3); // feed + 2 部电影
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('无 key 时不调用 TMDB，保留原封面', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => SAMPLE_FEED });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const movies = await syncDoubanMovies('1017197', '');
      expect(movies[0].cover).toContain('doubanio');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('后台同步接口 /api/admin/douban/sync', () => {
  it('同步成功返回条数并预热缓存', async () => {
    const { app } = makeTestApp();
    await enableDouban(app);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => SAMPLE_FEED })
      .mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const token = await loginAsAdmin(app);
      const res = await app.request('/api/admin/douban/sync', { method: 'POST', headers: authHeaders(token) });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { count: number } };
      expect(body.data.count).toBe(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('未开启时返回 400', async () => {
    const { app } = makeTestApp();
    const token = await loginAsAdmin(app);
    const res = await app.request('/api/admin/douban/sync', { method: 'POST', headers: authHeaders(token) });
    expect(res.status).toBe(400);
  });
});

describe('封面代理 /api/cover', () => {
  it('非法地址返回 400', async () => {
    const { app } = makeTestApp();
    const res = await app.request('/api/cover?url=https://evil.com/x.jpg');
    expect(res.status).toBe(400);
  });

  it('合法豆瓣地址带 Referer 拉取并返回图片', async () => {
    const { app } = makeTestApp();
    const imgBytes = new Uint8Array([137, 80, 78, 71]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => imgBytes,
      headers: { get: () => 'image/jpeg' },
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res = await app.request('/api/cover?url=' + encodeURIComponent('https://img2.doubanio.com/view/photo/s_ratio_poster/public/p1.jpg'));
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('image/jpeg');
      const fetchArgs = fetchMock.mock.calls[0];
      expect(fetchArgs[1].headers.Referer).toBe('https://movie.douban.com/');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('syncDoubanMovies 将豆瓣封面重写为代理地址', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => SAMPLE_FEED });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const movies = await syncDoubanMovies('1017197', '');
      // SAMPLE_FEED 第一条封面为 doubanio → 代理；第二条无封面保持空
      expect(movies[0].cover).toContain('/api/cover?url=');
      expect(movies[0].cover).toContain(encodeURIComponent('https://img3.doubanio.com'));
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
