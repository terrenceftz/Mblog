import Lenis from 'lenis';

/**
 * Lenis 平滑滚动：两个主题均启用（极简模式的文章列表同样使用平滑动效）。
 */
function init() {
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
