import Lenis from 'lenis';

/**
 * Lenis 平滑滚动：两个主题均启用（极简模式的文章列表同样使用平滑动效）。
 * 「减少动态」用户跳过（对齐 capabilities 智能降级约定），回落原生滚动。
 */
function init() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const html = document.documentElement;
  let lenis: Lenis | null = null;

  function apply() {
    if (!lenis) lenis = new Lenis({ autoRaf: true });
    lenis.start();
  }

  apply();
  const observer = new MutationObserver(apply);
  observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
}

init();
