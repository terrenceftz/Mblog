// 滚动入场：带 [data-reveal] 的元素进入视口时加 .is-visible（一次性）。
// stagger 用元素自身的 style="--reveal-delay: Nms" 控制。
// prefers-reduced-motion 时直接全部可见，跳过动画。
const els = document.querySelectorAll<HTMLElement>('[data-reveal]');
if (els.length) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    els.forEach((el) => el.classList.add('is-visible'));
  } else {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    els.forEach((el) => obs.observe(el));
  }
}
