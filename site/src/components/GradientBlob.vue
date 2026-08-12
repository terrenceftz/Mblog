<script setup lang="ts">
// 渐变 blob 氛围背景（借鉴 eonova）：多层径向渐变 + 高斯模糊的柔和色块
// 置于页面内容容器内作为背景氛围层（pointer-events: none）
</script>

<template>
  <div class="gradient-blob" aria-hidden="true" />
</template>

<style scoped>
.gradient-blob {
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
/* reader（极简）主题下隐藏辉光氛围：违背极简约定，与朴素风格冲突。
   用 :global 提升特异性，确保覆盖上方 scoped 的 .gradient-blob 规则 */
:global([data-theme='reader']) .gradient-blob {
  display: none;
}
</style>
