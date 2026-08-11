import { describe, it, expect, vi } from 'vitest';
import { makeTestApp, loginAsAdmin, authHeaders } from './helpers';
import { fetchDoubanMovies } from '../src/routes/public/douban';
import { syncDoubanMovies } from '../src/routes/public/douban';

// 豆瓣「看过」收藏页 HTML 样例（<div class="item comment-item"> 为单条记录）
const SAMPLE_COLLECT = `<div class="grid-view">
  <div class="item comment-item" data-cid="1">
    <div class="pic"><a title="辛德勒的名单" href="https://movie.douban.com/subject/1295124/" class="nbg"><img alt="辛德勒的名单" src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p492406163.jpg"></a></div>
    <div class="info"><ul>
      <li class="title"><a href="https://movie.douban.com/subject/1295124/"><em>辛德勒的名单</em> / Schindler's List</a></li>
      <li class="intro">1993-11-30 / 剧情 / 历史 / ...</li>
      <li><span class="rating5-t"></span><span class="date">2005-08-29</span></li>
    </ul></div>
  </div>
  <div class="item comment-item" data-cid="2">
    <div class="pic"><a title="星际穿越" href="https://movie.douban.com/subject/1889243/" class="nbg"><img alt="星际穿越" src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2206088801.jpg"></a></div>
    <div class="info"><ul>
      <li class="title"><a href="https://movie.douban.com/subject/1889243/"><em>星际穿越</em> / Interstellar</a></li>
      <li class="intro">2014-11-05 / 科幻 / ...</li>
      <li><span class="rating4-t"></span><span class="date">2015-01-10</span></li>
    </ul></div>
  </div>
</div>`;

// 空页：无 comment-item 记录 → 终止分页
const EMPTY_COLLECT = '<html><body>没有更多记录</body></html>';

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

describe('fetchDoubanMovies', () => {
  it('解析收藏页电影：评分、日期、英文片名', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => SAMPLE_COLLECT })
      .mockResolvedValue({ ok: true, text: async () => EMPTY_COLLECT });
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
      await expect(fetchDoubanMovies('x')).rejects.toThrow('Douban collect 403');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

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
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => SAMPLE_COLLECT })
      .mockResolvedValue({ ok: true, text: async () => EMPTY_COLLECT });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res1 = await app.request('/api/douban');
      const body1 = (await res1.json()) as { data: { enabled: boolean; movies: { title: string }[] } };
      expect(body1.data.enabled).toBe(true);
      expect(body1.data.movies.map((m) => m.title)).toEqual(['辛德勒的名单', '星际穿越']);
      await app.request('/api/douban');
      expect(fetchMock).toHaveBeenCalledTimes(2); // 第 1 页 + 空页终止；第二次请求命中缓存
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
      .mockResolvedValueOnce({ ok: true, text: async () => SAMPLE_COLLECT })
      .mockResolvedValueOnce({ ok: true, text: async () => EMPTY_COLLECT })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ poster_path: '/a.jpg' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ poster_path: null }] }) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const movies = await syncDoubanMovies('1017197', 'testkey');
      expect(movies).toHaveLength(2);
      expect(movies[0].cover).toBe('https://image.tmdb.org/t/p/w500/a.jpg');
      expect(movies[1].cover).toContain('/api/cover?url='); // 无 poster_path → 回退豆瓣封面并走代理
      expect(fetchMock).toHaveBeenCalledTimes(4); // 收藏页 2 次（含空页终止）+ 2 部电影 TMDB
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('无 key 时不调用 TMDB，保留原封面', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => SAMPLE_COLLECT })
      .mockResolvedValue({ ok: true, text: async () => EMPTY_COLLECT });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const movies = await syncDoubanMovies('1017197', '');
      expect(movies[0].cover).toContain('doubanio');
      expect(fetchMock).toHaveBeenCalledTimes(2); // 收藏页 2 次，无 TMDB 调用
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
      .mockResolvedValueOnce({ ok: true, text: async () => SAMPLE_COLLECT })
      .mockResolvedValue({ ok: true, text: async () => EMPTY_COLLECT });
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
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => SAMPLE_COLLECT })
      .mockResolvedValue({ ok: true, text: async () => EMPTY_COLLECT });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const movies = await syncDoubanMovies('1017197', '');
      expect(movies[0].cover).toContain('/api/cover?url=');
      expect(movies[0].cover).toContain(encodeURIComponent('https://img3.doubanio.com'));
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
