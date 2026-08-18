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
  try {
    // inferSize: 让 astro 拉取远程图推断宽高（远程图不显式传 width/height 会报 CLS 错误）
    const result = await getImage({ src: absolute, widths, sizes, format, inferSize: true });
    return { src: result.src, srcset: result.srcSet.attribute, sizes };
  } catch (err) {
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
