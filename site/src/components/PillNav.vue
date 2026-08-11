<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import gsap from 'gsap/dist/gsap.js'; // CJS 构建，避免 SSR 下 ESM 入口加载失败

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
  url === '/' ? props.path === '/' : props.path === url || (url !== '/' && props.path.startsWith(url));

const navItemsRef = ref<HTMLElement | null>(null);
const circleRefs = ref<HTMLElement[]>([]);
const labelRefs = ref<HTMLElement[]>([]);
const whiteRefs = ref<HTMLElement[]>([]);
const timelines: (gsap.core.Timeline | null)[] = [];

function layout() {
  circleRefs.value.forEach((circle, index) => {
    const pill = circle?.parentElement;
    if (!pill) return;
    const { width: w, height: h } = pill.getBoundingClientRect();
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
onMounted(() => {
  layout();
  onResize = () => layout();
  window.addEventListener('resize', onResize);

  // 初始加载动画：导航容器宽度展开
  if (navItemsRef.value) {
    gsap.set(navItemsRef.value, { width: 0, overflow: 'hidden' });
    gsap.to(navItemsRef.value, { width: 'auto', duration: 0.6, ease: props.ease });
  }
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  timelines.forEach((tl) => tl?.kill());
});
</script>

<template>
  <div ref="navItemsRef" class="pill-nav-items">
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
    </ul>
  </div>
</template>

<style scoped>
.pill-nav-items {
  position: relative;
  display: flex;
  align-items: center;
  height: 42px;
  background: rgba(19, 19, 22, 0.65);
  border: 1px solid #26262a;
  border-radius: 9999px;
  backdrop-filter: blur(10px);
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
  color: #a1a1aa;
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
  background: #e8b64c;
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
  color: #09090b;
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
  background: #e8b64c;
  border-radius: 50%;
  z-index: 4;
}
.pill.is-active {
  color: #f4f4f5;
}
</style>
