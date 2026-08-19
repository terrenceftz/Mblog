import { getImage } from 'astro:assets';

export interface OptimizedImage {
  src: string;
  srcset: string;
  sizes: string;
}

interface OptimizeOptions {
  /** 当前请求 URL（SSR 把相对路径转绝对用）；PUBLIC_API_BASE 优先级更高 */
  base?: string | URL;
  widths?: number[];
  sizes?: string;
  format?: 'webp' | 'avif';
}

// 已知服务端不可达的图源（服务器在国内，TMDB 直连被墙）：SSR 优化直接跳过，
// 浏览器端维持直连（墙外用户正常）。避免每次渲染白跑一次 fetch + 刷日志。
const SSR_SKIP_HOSTS = new Set(['image.tmdb.org']);

// 优化失败短期缓存：同一 URL 10 分钟内不再重试（外网图源抖动时不反复空跑）
const FAIL_TTL = 10 * 60 * 1000;
const failCache = new Map<string, number>();

/**
 * 响应式图片：把封面/相册图出多尺寸 webp srcset（sharp 处理，disk 缓存）。
 * - 相对/站内路径按 base（或 PUBLIC_API_BASE）转绝对——SSR 下 astro:assets 需要可抓取的 URL
 * - 任一环节失败（抓取失败/处理失败）回退原地址，绝不影响页面渲染
 * - 只在 SSR（服务端渲染阶段）调用；浏览器端 island 拿不到处理结果就保持原图
 */
export async function optimizeImage(
  src: string,
  { base, widths = [400, 800, 1200], sizes = '100vw', format = 'webp' }: OptimizeOptions = {},
): Promise<OptimizedImage> {
  if (!src) return { src, srcset: '', sizes };
  const absolute = toAbsolute(src, base);
  if (!absolute) return { src, srcset: '', sizes };
  const failAt = failCache.get(absolute);
  if (failAt && Date.now() - failAt < FAIL_TTL) return { src, srcset: '', sizes };
  try {
    if (SSR_SKIP_HOSTS.has(new URL(absolute).hostname)) return { src, srcset: '', sizes };
    // inferSize: 让 astro 拉取远程图推断宽高（远程图不显式传 width/height 会报 CLS 错误）
    const result = await getImage({ src: absolute, widths, sizes, format, inferSize: true });
    return { src: result.src, srcset: result.srcSet.attribute, sizes };
  } catch (err) {
    failCache.set(absolute, Date.now());
    if (failCache.size > 500) {
      const now = Date.now();
      for (const [k, t] of failCache) {
        if (now - t >= FAIL_TTL) failCache.delete(k);
      }
    }
    console.warn('[img] 优化失败，回退原图：', src, (err as Error).message);
    return { src, srcset: '', sizes };
  }
}

/** 相对/站内路径 → 服务端可抓取的绝对 URL。
 * getImage 的 href 只被 SSR 服务端抓取（浏览器拿到的是 /_image 端点，不直接访问该地址），
 * 所以优先解析到「服务器内网可达」地址：
 *   API_BASE（生产 localhost:3003 直连后端）> PUBLIC_API_BASE（本地直跑无反代）> 请求源。
 * 注意：服务器抓自己的公网域名常因安全组 hairpin 限制失败（线上踩过，fetch failed）。 */
function toAbsolute(src: string, base?: string | URL): string {
  if (/^https?:\/\//i.test(src)) return src;
  const root = process.env.API_BASE || process.env.PUBLIC_API_BASE || (base ? String(base) : '');
  if (!root) return '';
  try {
    return new URL(src, root).href;
  } catch {
    return '';
  }
}
