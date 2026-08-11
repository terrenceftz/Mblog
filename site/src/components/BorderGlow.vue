<script setup lang="ts">
// Border Glow 控制器（reactbits BorderGlow 的轻量移植）
// 单一 island 通过 document 级事件委托跟踪所有 .border-glow-card 的光标位置，
// 只更新卡片上的两个 CSS 变量（--cursor-angle / --edge-proximity），
// 全部视觉效果由 normal.css 的 .border-glow-card 样式完成。
import { onMounted, onBeforeUnmount } from 'vue';

function onPointerMove(e: PointerEvent) {
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

onMounted(() => document.addEventListener('pointermove', onPointerMove, { passive: true }));
onBeforeUnmount(() => document.removeEventListener('pointermove', onPointerMove));
</script>

<template>
  <div class="border-glow-controller" aria-hidden="true" />
</template>
