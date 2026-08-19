import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { posts } from '../../db/schema';
import { getSettings } from '../../lib/settings';
import { parseThemeConfig } from '../../lib/themeConfig';
import { renderMarkdown } from '../../services/markdown';
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

  // RSS：description=纯文本摘要，content:encoded=渲染后全文（阅读器内完整阅读）。
  // 全文 HTML 由写入链路同一套 rehype-sanitize 渲染，安全性与文章页一致。
  app.get('/rss', async (c) => {
    const { site_name: siteName, site_description: siteDesc, site_url: siteUrl } = getSettings(ctx, [
      'site_name',
      'site_description',
      'site_url',
    ]);
    const baseUrl = siteUrl || 'http://localhost';
    const list = ctx.db
      .select({
        title: posts.title, slug: posts.slug, summary: posts.summary,
        contentMd: posts.contentMd, createdAt: posts.createdAt,
      })
      .from(posts)
      .where(eq(posts.status, 'published'))
      .orderBy(desc(posts.createdAt))
      .limit(20)
      .all();

    const items = (
      await Promise.all(
        list.map(async (p) => {
          const link = `${baseUrl}/post/${p.slug}`;
          const html = await renderMarkdown(p.contentMd || '');
          // 绝对化站内相对链接（/uploads、/api/cover），阅读器内无站点源可解析相对地址
          const fullHtml = html.replace(/(src|href)="\/(?!\/)/g, `$1="${baseUrl}/`);
          return `<item>
  <title>${cdata(p.title)}</title>
  <link>${link}</link>
  <guid>${link}</guid>
  <description>${cdata(p.summary)}</description>
  <content:encoded>${cdata(fullHtml)}</content:encoded>
  <pubDate>${new Date(p.createdAt).toUTCString()}</pubDate>
</item>`;
        }),
      )
    ).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${cdata(siteName)}</title>
  <description>${cdata(siteDesc)}</description>
  <link>${baseUrl}</link>
  <atom:link href="${baseUrl}/api/rss" rel="self" type="application/rss+xml"/>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
</channel>
</rss>`;
    c.header('Content-Type', 'application/rss+xml; charset=utf-8');
    c.header('Cache-Control', 'public, max-age=600'); // 阅读器轮询友好：10 分钟内直接用缓存
    return c.body(xml);
  });

  app.get('/settings/public', (c) => {
    const {
      site_name: siteName, site_description: siteDesc, site_url: siteUrl, default_theme: theme,
      friend_link_enabled: friendLinkEnabled,
      nav_menu_normal: navMenuNormalRaw, nav_menu_reader: navMenuReaderRaw,
      theme_normal: themeNormalRaw, theme_reader: themeReaderRaw,
      github_enabled: githubEnabled, github_username: githubUsername,
      douban_enabled: doubanEnabled, douban_uid: doubanUid,
      turnstile_site_key: turnstileSiteKey,
      author, avatar, about_content: aboutContent, about_blocks: aboutBlocksRaw,
      netease_playlist_id: neteasePlaylistId,
    } = getSettings(ctx, [
      'site_name', 'site_description', 'site_url', 'default_theme', 'friend_link_enabled',
      'nav_menu_normal', 'nav_menu_reader',
      'theme_normal', 'theme_reader', 'github_enabled', 'github_username',
      'douban_enabled', 'douban_uid', 'turnstile_site_key', 'author', 'avatar', 'about_content', 'about_blocks',
      'netease_playlist_id',
    ]);

    // 解析导航菜单 JSON；非法/空则回退空
    const parseMenu = (raw: string): { label: string; url: string }[] => {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((i) => i && typeof i.label === 'string' && typeof i.url === 'string')
            .map((i) => ({ label: i.label, url: i.url }));
        }
      } catch {
        /* ignore */
      }
      return [];
    };
    const navMenuNormal = parseMenu(navMenuNormalRaw);
    const navMenuReader = parseMenu(navMenuReaderRaw);

    // 解析关于页结构化块 JSON；只按 type 白名单过滤，字段校验由前台渲染时兜底
    const parseAboutBlocks = (raw: string): unknown[] => {
      const TYPES = new Set(['text', 'kv', 'quote', 'progress', 'marquee']);
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((b) => b && typeof b === 'object' && typeof (b as any).type === 'string' && TYPES.has((b as any).type));
        }
      } catch {
        /* ignore */
      }
      return [];
    };
    const aboutBlocks = parseAboutBlocks(aboutBlocksRaw);

    return c.json({
      data: {
        siteName, siteDesc, siteUrl, theme, friendLinkEnabled: friendLinkEnabled === '1',
        navMenuNormal, navMenuReader, aboutContent, aboutBlocks,
        themeNormal: parseThemeConfig(themeNormalRaw),
        themeReader: parseThemeConfig(themeReaderRaw),
        githubEnabled: githubEnabled === '1',
        githubUsername,
        doubanEnabled: doubanEnabled === '1',
        doubanUid,
        turnstileSiteKey,
        author,
        avatar,
        neteasePlaylistId,
      },
    });
  });

  return app;
}
