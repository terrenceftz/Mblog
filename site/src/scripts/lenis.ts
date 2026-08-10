import Lenis from 'lenis';

/**
 * Lenis 平滑滚动：正常主题启用；阅读模式（data-theme=reader）恢复原生滚动。
 */
function init() {
  const html = document.documentElement;
  let lenis: Lenis | null = null;

  function apply() {
    if (html.dataset.theme === 'normal') {
      if (!lenis) lenis = new Lenis({ autoRaf: true });
      lenis.start();
    } else {
      lenis?.stop();
    }
  }

  apply();
  const observer = new MutationObserver(apply);
  observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
}

init();
