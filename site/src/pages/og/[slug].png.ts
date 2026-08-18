import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { getPost, type PostDetail } from '../../lib/api';

// 动态 OG 分享图：深色渐变 + 琥珀光斑 + 文章标题（中文换行）
// 注意：SVG 中文渲染依赖服务器字体（本地 Windows 有中文字体；Docker 部署需安装 CJK 字体）

export const prerender = false;

// 服务端内存缓存：OG 图渲染（sharp）开销不低，按 slug+updatedAt 缓存，文章更新即失效
const OG_CACHE_TTL = 60 * 60 * 1000; // 与响应 Cache-Control 一致（1h）
const ogCache = new Map<string, { time: number; png: Buffer<ArrayBuffer> }>();

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// 中文按字符数换行，最多 3 行
function wrapTitle(title: string, perLine = 16): string[] {
  const chars = [...title];
  const lines: string[] = [];
  for (let i = 0; i < chars.length && lines.length < 3; i += perLine) {
    lines.push(chars.slice(i, i + perLine).join(''));
  }
  return lines;
}

export const GET: APIRoute = async ({ params }) => {
  const { slug } = params;
  let post: PostDetail | null = null;
  try {
    post = await getPost(slug!);
  } catch {
    return new Response('Not Found', { status: 404 });
  }
  if (!post) return new Response('Not Found', { status: 404 });

  // 命中缓存直接返回（文章未更新），避免每次请求都跑 sharp 渲染
  const cacheKey = `${slug}:${post.updatedAt}`;
  const hit = ogCache.get(cacheKey);
  if (hit && Date.now() - hit.time < OG_CACHE_TTL) {
    return new Response(hit.png, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
    });
  }

  const lines = wrapTitle(post.title);
  const titleTsps = lines
    .map((line, i) => `<tspan x="80" dy="${i === 0 ? 0 : 74}">${escapeXml(line)}</tspan>`)
    .join('');
  const titleHeight = lines.length * 74;
  const date = new Date(post.createdAt).toLocaleDateString('zh-CN');

  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1a1a21"/>
      <stop offset="1" stop-color="#0b0b0e"/>
    </linearGradient>
    <radialGradient id="blob" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="rgba(232,182,76,0.5)"/>
      <stop offset="1" stop-color="rgba(232,182,76,0)"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <ellipse cx="900" cy="120" rx="340" ry="170" fill="url(#blob)"/>
  <ellipse cx="220" cy="480" rx="260" ry="150" fill="rgba(124,156,245,0.14)"/>
  <rect x="80" y="96" width="56" height="6" rx="3" fill="#e8b64c"/>
  <text x="80" y="150" font-family="Georgia, serif" font-size="22" fill="#e8b64c" letter-spacing="2">MBLOG · ${escapeXml(date)}</text>
  <text x="80" y="${190 + titleHeight / 2}" font-family="'Microsoft YaHei','PingFang SC','Noto Sans SC',sans-serif" font-size="56" font-weight="700" fill="#f4f4f5">${titleTsps}</text>
  <text x="80" y="540" font-family="'Microsoft YaHei',sans-serif" font-size="24" fill="#9d9d95">${escapeXml(post.summary.slice(0, 60))}</text>
</svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  if (ogCache.size >= 200) ogCache.clear();
  ogCache.set(cacheKey, { time: Date.now(), png });
  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
