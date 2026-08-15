<script setup lang="ts">
// 首屏背景包装：桌面端（fancy）渲染 LiquidEther WebGL 流体；
// 低端设备 / 触屏 / 开启「减少动态」时降级为静态多层径向渐变（视觉接近、零 WebGL 开销）。
// SSR 默认渲染静态层（不依赖 window），hydration 后桌面端再切到流体（短暂过渡，可接受）。
import { ref, onMounted, defineAsyncComponent } from 'vue';
// 异步加载 LiquidEther：three.js 只在桌面端（fancy）真正渲染流体时才下载，
// 低端/触屏/减少动态设备降级为静态渐变，不再背负整块 WebGL 代码
const LiquidEther = defineAsyncComponent(() => import('./LiquidEther.vue'));
import { detectCapabilities } from '../lib/capabilities';

const fancy = ref(false);
onMounted(() => {
  fancy.value = detectCapabilities().fancy;
});
</script>

<template>
  <LiquidEther v-if="fancy" />
  <div v-else class="hero-static-bg" aria-hidden="true" />
</template>

<style scoped>
.hero-static-bg {
  position: absolute;
  top: -140px;
  left: 50%;
  transform: translateX(-50%);
  width: min(1100px, 92%);
  height: 400px;
  pointer-events: none;
  z-index: 0;
  filter: blur(70px);
  background:
    radial-gradient(ellipse 42% 52% at 20% 30%, rgba(232, 182, 76, 0.4), transparent 72%),
    radial-gradient(ellipse 36% 55% at 74% 24%, rgba(249, 115, 22, 0.28), transparent 72%),
    radial-gradient(ellipse 30% 45% at 48% 72%, rgba(124, 156, 245, 0.2), transparent 72%);
}
</style>
