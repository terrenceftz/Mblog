import type { APIRoute } from 'astro';
import { getPosts, getPublicSettings } from '../lib/api';

// 动态 sitemap：静态页 + 全部文章详情页。siteUrl 取自后台站点设置。
export const GET: APIRoute = async () => {
  const settings = await getPublicSettings().catch(() => ({ siteUrl: 'http://localhost' } as any));
  const base = (settings.siteUrl || 'http://localhost').replace(/\/$/, '');
  const staticPages = ['/', '/posts', '/archive', '/friends', '/projects', '/douban', '/talk'];
  const data = await getPosts({ page: 1, pageSize: 1000 }).catch(() => ({ list: [] as any[], total: 0 }));

  const entries = [
    ...staticPages.map((p) => ({ loc: `${base}${p}`, priority: p === '/' ? '1.0' : '0.8', lastmod: '' })),
    ...data.list.map((p) => ({
      loc: `${base}/post/${p.slug}`,
      priority: '0.6',
      lastmod: new Date(p.createdAt).toISOString(),
    })),
  ];

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries
      .map(
        (e) =>
          `  <url><loc>${e.loc}</loc><priority>${e.priority}</priority>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</url>`,
      )
      .join('\n') +
    `\n</urlset>`;

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
