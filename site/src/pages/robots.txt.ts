import type { APIRoute } from 'astro';
import { getPublicSettings } from '../lib/api';

// 动态 robots.txt：全站允许抓取，指向 sitemap。
export const GET: APIRoute = async () => {
  const settings = await getPublicSettings().catch(() => ({ siteUrl: 'http://localhost' } as any));
  const base = (settings.siteUrl || 'http://localhost').replace(/\/$/, '');
  const body = `User-agent: *
Allow: /

Sitemap: ${base}/sitemap.xml
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
