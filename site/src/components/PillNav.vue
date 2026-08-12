<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import gsap from 'gsap/dist/gsap.js'; // CJS 构建，避免 SSR 下 ESM 入口加载失败
import ThemeToggle from './ThemeToggle.vue';

// PillNav 药丸导航（移植自 reactbits.dev，GSAP 实现）
// 悬停：圆形从底部升起填充药丸 + 文字上滑翻转；初始加载：宽度展开
interface NavItem {
  label: string;
  url: string;
}

const props = withDefaults(
  defineProps<{
    items: NavItem[];
    /** 当前路径（用于高亮） */
    path?: string;
    ease?: string;
  }>(),
  { path: '', ease: 'power3.easeOut' },
);

const isActive = (url: string) =>
  url === '/' ? props.path === '/' : props.path === url || props.path.startsWith(url + '/');

const navItemsRef = ref<HTMLElement | null>(null);
const circleRefs = ref<HTMLElement[]>([]);
const labelRefs = ref<HTMLElement[]>([]);
const whiteRefs = ref<HTMLElement[]>([]);
const timelines: (gsap.core.Timeline | null)[] = [];

function layout() {
  circleRefs.value.forEach((circle, index) => {
    const pill = circle?.parentElement;
    if (!pill) return;
    const rect = pill.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    // 无布局（隐藏/display:none）时跳过几何计算，避免 NaN
    if (w === 0 || h === 0) return;
    const R = ((w * w) / 4 + h * h) / (2 * h);
    const D = Math.ceil(2 * R) + 2;
    const delta = Math.ceil(R - Math.sqrt(Math.max(0, R * R - (w * w) / 4))) + 1;
    const originY = D - delta;

    circle.style.width = `${D}px`;
    circle.style.height = `${D}px`;
    circle.style.bottom = `-${delta}px`;
    gsap.set(circle, { xPercent: -50, scale: 0, transformOrigin: `50% ${originY}px` });

    const label = labelRefs.value[index];
    const white = whiteRefs.value[index];
    if (label) gsap.set(label, { y: 0 });
    if (white) gsap.set(white, { y: h + 12, opacity: 0 });

    timelines[index]?.kill();
    const tl = gsap.timeline({ paused: true });
    tl.to(circle, { scale: 1.2, xPercent: -50, duration: 0.5, ease: props.ease, overwrite: 'auto' }, 0);
    if (label) tl.to(label, { y: -(h + 8), duration: 0.5, ease: props.ease, overwrite: 'auto' }, 0);
    if (white) tl.to(white, { y: 0, opacity: 1, duration: 0.5, ease: props.ease, overwrite: 'auto' }, 0);
    timelines[index] = tl;
  });
}

function handleEnter(i: number) {
  timelines[i]?.play();
}
function handleLeave(i: number) {
  timelines[i]?.reverse();
}

let onResize: () => void = () => {};
let onThemeChange: () => void = () => {};

// 宽度展开动画：仅在元素有真实布局时执行
//（reader 主题下 header 为 display:none，getClientRects 为空，GSAP 量不到 auto 宽度会停在 0）
function animateWidthIn() {
  const el = navItemsRef.value;
  if (!el) return;
  if (el.getClientRects().length === 0) {
    // 隐藏态：直接落到最终状态，避免 width:0;overflow:hidden 内联样式残留
    gsap.set(el, { width: 'auto', overflow: 'visible' });
    return;
  }
  gsap.set(el, { width: 0, overflow: 'hidden' });
  gsap.to(el, {
    width: 'auto',
    duration: 0.6,
    ease: props.ease,
    onComplete: () => {
      // 强制最终宽度为 auto，保证任何旧的 width:0 内联样式都不再存活
      gsap.set(el, { width: 'auto', overflow: 'visible' });
    },
  });
}

// 主题切换后 header 可见性可能变化：等 rAF 让布局可测后重新应用宽度状态并重算几何
function restoreVisible() {
  requestAnimationFrame(() => {
    animateWidthIn();
    layout();
  });
}

onMounted(() => {
  layout();
  onResize = () => layout();
  window.addEventListener('resize', onResize);

  animateWidthIn();

  // ThemeToggle 切换主题后触发；重跑宽度状态 + 悬停几何（元素可能刚从 display:none 恢复）
  onThemeChange = () => restoreVisible();
  window.addEventListener('mblog-theme-change', onThemeChange);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  window.removeEventListener('mblog-theme-change', onThemeChange);
  timelines.forEach((tl) => tl?.kill());
});
</script>

<template>
  <div ref="navItemsRef" class="pill-nav-items">
    <a class="pill-logo" href="/" aria-label="首页">
      <svg viewBox="0 0 681.51 197.5" xmlns="http://www.w3.org/2000/svg">
        <g>
          <path fill="hsl(275.93, 88.66%, 61.96%)" d="M161.81,2.12L9.42,122.73c-12.68,10.04-11.87,27.8-1.67,37.48l67.58-17.41c12.25-3.16,22.75,9.19,17.68,20.78l-5.5,12.54c24.74-1.3,46.71-18.02,53.95-42.66L177.02,12.38c2.65-9.01-7.85-16.09-15.21-10.26Z"/>
          <path fill="hsl(275.93, 88.66%, 61.96%)" d="M20.78,166.59c-5.27-.86-9.66-3.18-13.03-6.38h0s30.54,29.09,30.54,29.09c14.91,14.2,39.39,9.28,47.65-9.57l1.58-3.61c-4.2.22-8.48.01-12.79-.69l-53.94-8.84Z"/>
          <path fill="hsl(275.93, 88.66%, 51.96%)" d="M75.33,142.81L7.75,160.21c3.37,3.2,7.76,5.51,13.03,6.38l53.94,8.84c4.3.71,8.59.91,12.79.69l5.5-12.54c5.08-11.59-5.42-23.93-17.68-20.78Z"/>
        </g>
        <g>
          <path fill="hsl(275.93, 88.66%, 61.96%)" d="M262.99,161.74v-49.32l-23.53,49.32h-11.31l-23.08-49.32h-.45c0,2.42.15,6.04.45,10.86v38.46h-11.31v-58.37h16.29l23.98,49.32,23.53-49.32h16.29v58.37h-10.86Z"/>
          <path fill="hsl(275.93, 88.66%, 61.96%)" d="M290.14,103.37h36.65c14.78.3,22.47,5.13,23.08,14.48,0,5.73-3.62,9.81-10.86,12.22,10.25,2.71,15.38,7.54,15.38,14.48,0,4.23-1.97,7.85-5.88,10.86-5.13,4.23-12.67,6.33-22.62,6.33h-35.74v-58.37ZM301.45,127.81h19.91c11.76.3,17.49-2.86,17.19-9.5,0-5.73-5.73-8.6-17.19-8.6h-19.91v18.1ZM301.45,154.95h23.98c11.46-.3,17.34-3.77,17.65-10.41,0-6.63-6.64-9.95-19.91-9.95h-21.72v20.36Z"/>
          <path fill="hsl(275.93, 88.66%, 61.96%)" d="M433.57,154.95c-7.24,5.43-17.19,8.14-29.86,8.14-13.57,0-23.98-2.86-31.22-8.6-6.04-5.73-9.21-12.51-9.5-20.36.3-9.95,4.82-17.94,13.57-23.98,6.93-4.22,15.98-6.33,27.15-6.33,12.36,0,22.17,2.71,29.41,8.14,6.94,6.04,10.55,13.43,10.86,22.17-.3,8.45-3.78,15.38-10.41,20.81ZM403.71,110.16c-18.4.61-28.05,8.6-28.96,23.98.91,14.48,10.56,22.02,28.96,22.62,18.1-.6,27.75-8.14,28.96-22.62-1.21-15.08-10.86-23.08-28.96-23.98Z"/>
          <path fill="hsl(275.93, 88.66%, 61.96%)" d="M468.41,161.74h-11.31v-58.82h11.31v28.5l40.27-28.5h15.84l-34.84,23.98,35.74,34.84h-14.93l-28.96-29.41-13.12,8.6v20.81Z"/>
          <path fill="hsl(275.93, 88.66%, 61.96%)" d="M596.45,161.74h-61.08v-59.27h60.18v6.79h-48.87v18.55h45.25v7.24h-45.25v19.46h49.77v7.24Z"/>
          <path fill="hsl(275.93, 88.66%, 61.96%)" d="M623.6,161.74h-11.31v-57.91h38.46c8.44,0,14.78,1.06,19,3.17,5.73,2.11,8.6,6.19,8.6,12.22,0,6.33-3.92,11.01-11.76,14.03,6.63,1.21,9.95,4.98,9.95,11.31l.91,10.41c-.3,2.71,1.05,4.52,4.07,5.43v1.36h-14.03c-.91-2.71-1.51-7.54-1.81-14.48.3-6.94-4.68-10.41-14.93-10.41h-27.15v24.88ZM623.6,130.07h26.24c11.16,0,16.74-3.32,16.74-9.95s-4.98-9.95-14.93-9.95h-28.05v19.91Z"/>
        </g>
      </svg>
    </a>
    <ul class="pill-list">
      <li v-for="(item, i) in items" :key="item.url + item.label">
        <a
          :href="item.url"
          class="pill"
          :class="{ 'is-active': isActive(item.url) }"
          @mouseenter="handleEnter(i)"
          @mouseleave="handleLeave(i)"
        >
          <span :ref="(el) => (circleRefs[i] = el)" class="hover-circle"></span>
          <span class="label-stack">
            <span :ref="(el) => (labelRefs[i] = el)" class="pill-label">{{ item.label }}</span>
            <span :ref="(el) => (whiteRefs[i] = el)" class="pill-label-hover">{{ item.label }}</span>
          </span>
        </a>
      </li>
      <li class="pill-theme">
        <ThemeToggle variant="icon" />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.pill-nav-items {
  position: relative;
  display: flex;
  align-items: center;
  height: 42px;
  background: color-mix(in srgb, var(--color-surface) 65%, transparent);
  border: 1px solid var(--color-border);
  border-radius: 9999px;
  backdrop-filter: blur(10px);
}
.pill-logo {
  display: inline-flex;
  align-items: center;
  height: 100%;
  padding: 0 16px 0 14px;
  margin-right: 2px;
  text-decoration: none;
  flex-shrink: 0;
}
.pill-logo svg {
  height: 24px;
  width: auto;
  display: block;
}
.pill-list {
  list-style: none;
  display: flex;
  align-items: stretch;
  gap: 3px;
  margin: 0;
  padding: 3px;
  height: 100%;
}
.pill-list > li {
  display: flex;
  height: 100%;
}
.pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 0 16px;
  background: transparent;
  color: var(--color-text-secondary);
  text-decoration: none;
  border-radius: 9999px;
  box-sizing: border-box;
  font-weight: 600;
  font-size: 14px;
  line-height: 0;
  letter-spacing: 0.2px;
  white-space: nowrap;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: color 0.25s ease;
}
.pill .hover-circle {
  position: absolute;
  left: 50%;
  bottom: 0;
  border-radius: 50%;
  background: var(--color-primary);
  z-index: 1;
  display: block;
  pointer-events: none;
  will-change: transform;
}
.pill .label-stack {
  position: relative;
  display: inline-block;
  line-height: 1;
  z-index: 2;
}
.pill .pill-label {
  position: relative;
  z-index: 2;
  display: inline-block;
  line-height: 1;
  will-change: transform;
}
.pill .pill-label-hover {
  position: absolute;
  left: 0;
  top: 0;
  color: var(--color-primary-contrast);
  z-index: 3;
  display: inline-block;
  will-change: transform, opacity;
}
.pill.is-active::after {
  content: '';
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 12px;
  height: 12px;
  background: var(--color-primary);
  border-radius: 50%;
  z-index: 4;
}
.pill.is-active {
  color: var(--color-text);
}
</style>
