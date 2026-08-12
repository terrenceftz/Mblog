<script setup lang="ts">
// Border Glow 控制器（reactbits BorderGlow 的轻量移植）
// 单一 island 通过 document 级事件委托跟踪所有 .border-glow-card 的光标位置，
// 只更新卡片上的两个 CSS 变量（--cursor-angle / --edge-proximity），
// 全部视觉效果由 normal.css 的 .border-glow-card 样式完成。
import { onMounted, onBeforeUnmount } from 'vue';

let pending = false;
let lastEvent: PointerEvent | null = null;
let alive = false;

// 真正计算并写入 CSS 变量（在 rAF 内执行，合并同一帧内的多次 pointermove）
function applyAngles(e: PointerEvent) {
  const card = (e.target as HTMLElement | null)?.closest<HTMLElement>('.border-glow-card');
  if (!card) return;
  const rect = card.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const dx = x - cx;
  const dy = y - cy;

  // 边缘接近度 0..1：光标越靠近卡片边缘越大
  let kx = Infinity;
  let ky = Infinity;
  if (dx !== 0) kx = cx / Math.abs(dx);
  if (dy !== 0) ky = cy / Math.abs(dy);
  const edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);

  // 光标相对卡片中心的角度（与 reactbits 一致，0° 朝上顺时针）
  const angle = dx === 0 && dy === 0 ? 0 : (Math.atan2(dy, dx) * (180 / Math.PI) + 90 + 360) % 360;

  card.style.setProperty('--edge-proximity', (edge * 100).toFixed(3));
  card.style.setProperty('--cursor-angle', `${angle.toFixed(3)}deg`);
}

function onPointerMove(e: PointerEvent) {
  // reader 主题下 .border-glow-card 全部 display:none，getBoundingClientRect 必返回 0 且无意义：
  // 此处用一次廉价的 getAttribute 判定提前返回，避免持续 reflow。
  if (document.documentElement.getAttribute('data-theme') === 'reader') return;
  lastEvent = e;
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    if (!alive || !lastEvent) return;
    applyAngles(lastEvent);
  });
}

onMounted(() => {
  alive = true;
  document.addEventListener('pointermove', onPointerMove, { passive: true });
});
onBeforeUnmount(() => {
  alive = false;
  document.removeEventListener('pointermove', onPointerMove);
});
</script>

<template>
  <div class="border-glow-controller" aria-hidden="true" />
</template>
