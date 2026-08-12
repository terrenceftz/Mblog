// 设备能力检测：决定是否启用高强度视觉效果（WebGL 流体背景等）
// 桌面端默认 fancy=true 全特效；仅在能力不足或用户开启「减少动态」时降级。
// SSR 期 window 不存在，返回安全默认（不启用），hydration 后再实测。

export interface Capabilities {
  /** 用户系统开启了「减少动态效果」（无障碍偏好 / 晕动症） */
  reducedMotion: boolean;
  /** 低端设备：CPU 核心 / 内存不足，或触屏（粗略等价移动端） */
  lowEnd: boolean;
  /** 浏览器支持 WebGL */
  webgl: boolean;
  /** 综合：是否启用炫酷效果。桌面端默认 true */
  fancy: boolean;
}

let cached: Capabilities | null = null;

export function detectCapabilities(): Capabilities {
  if (cached) return cached;
  if (typeof window === 'undefined') {
    return { reducedMotion: false, lowEnd: false, webgl: false, fancy: false };
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const lowEnd = cores < 4 || mem < 4 || coarsePointer;
  let webgl = false;
  try {
    const canvas = document.createElement('canvas');
    webgl = !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    webgl = false;
  }
  cached = { reducedMotion, lowEnd, webgl, fancy: !reducedMotion && !lowEnd && webgl };
  return cached;
}
