import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { posts } from '../../db/schema';
import { getSettings } from '../../lib/settings';
import { parseThemeConfig } from '../../lib/themeConfig';
import type { Db } from '../../db';

// 转义 CDATA 内的结束序列，防止内容破坏 XML 结构
const cdata = (s: string) => `<![CDATA[${s.split(']]>').join(']]]]><![CDATA[>')}]]>`;

export function miscRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/archive', (c) => {
    const rows = ctx.db
      .select({ createdAt: posts.createdAt, title: posts.title, slug: posts.slug })
      .from(posts)
      .where(eq(posts.status, 'published'))
      .orderBy(desc(posts.createdAt))
      .all();

    const groups = new Map<string, typeof rows>();
    for (const r of rows) {
      const d = new Date(r.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    const data = [...groups.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([month, items]) => ({ month, items }));
    return c.json({ data });
  });

  app.get('/rss', (c) => {
    const { site_name: siteName, site_description: siteDesc, site_url: siteUrl } = getSettings(ctx, [
      'site_name',
      'site_description',
      'site_url',
    ]);
    const baseUrl = siteUrl || 'http://localhost';
    const list = ctx.db
      .select({ title: posts.title, slug: posts.slug, summary: posts.summary, createdAt: posts.createdAt })
      .from(posts)
      .where(eq(posts.status, 'published'))
      .orderBy(desc(posts.createdAt))
      .limit(20)
      .all();

    const items = list
      .map((p) => {
        const link = `${baseUrl}/post/${p.slug}`;
        return `<item>
  <title>${cdata(p.title)}</title>
  <link>${link}</link>
  <guid>${link}</guid>
  <description>${cdata(p.summary)}</description>
  <pubDate>${new Date(p.createdAt).toUTCString()}</pubDate>
</item>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${cdata(siteName)}</title>
  <description>${cdata(siteDesc)}</description>
  <link>${baseUrl}</link>
${items}
</channel>
</rss>`;
    c.header('Content-Type', 'application/rss+xml; charset=utf-8');
    return c.body(xml);
  });

  app.get('/settings/public', (c) => {
    const {
      site_name: siteName, site_description: siteDesc, default_theme: theme,
      friend_link_enabled: friendLinkEnabled, nav_menu: navMenuRaw,
      theme_normal: themeNormalRaw, theme_reader: themeReaderRaw,
      github_enabled: githubEnabled, github_username: githubUsername,
    } = getSettings(ctx, [
      'site_name', 'site_description', 'default_theme', 'friend_link_enabled', 'nav_menu',
      'theme_normal', 'theme_reader', 'github_enabled', 'github_username',
    ]);

    // 解析导航菜单 JSON；非法/空则回退默认
    let navMenu: { label: string; url: string }[] = [];
    try {
      const parsed = JSON.parse(navMenuRaw);
      if (Array.isArray(parsed)) {
        navMenu = parsed
          .filter((i) => i && typeof i.label === 'string' && typeof i.url === 'string')
          .map((i) => ({ label: i.label, url: i.url }));
      }
    } catch {
      navMenu = [];
    }

    return c.json({
      data: {
        siteName, siteDesc, theme, friendLinkEnabled: friendLinkEnabled === '1', navMenu,
        themeNormal: parseThemeConfig(themeNormalRaw),
        themeReader: parseThemeConfig(themeReaderRaw),
        githubEnabled: githubEnabled === '1',
        githubUsername,
      },
    });
  });

  return app;
}
