<script setup lang="ts">
// 统计气泡：首屏入场时数字从 0 滚到目标值（easeOutCubic）。
// SSR 渲染 0（避免 hydration mismatch），客户端 count-up；reduced-motion 直接落定。
import { ref, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps<{
  postTotal: number;
  commentTotal: number;
  totalViews: number;
  friendLinkCount: number;
}>();

const items = [
  { key: 'postTotal', label: '文章', cls: 'b1' },
  { key: 'commentTotal', label: '评论', cls: 'b2' },
  { key: 'totalViews', label: '浏览', cls: 'b3' },
  { key: 'friendLinkCount', label: '友链', cls: 'b4' },
] as const;

const displayed = ref<Record<string, number>>({
  postTotal: 0,
  commentTotal: 0,
  totalViews: 0,
  friendLinkCount: 0,
});
let raf = 0;

const fmt = (n: number) => n.toLocaleString('zh-CN');

onMounted(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const target = { ...props };
  if (reduced) {
    displayed.value = target;
    return;
  }
  const duration = 1500;
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
    displayed.value = {
      postTotal: Math.round(target.postTotal * eased),
      commentTotal: Math.round(target.commentTotal * eased),
      totalViews: Math.round(target.totalViews * eased),
      friendLinkCount: Math.round(target.friendLinkCount * eased),
    };
    if (t < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
});
onBeforeUnmount(() => cancelAnimationFrame(raf));
</script>

<template>
  <div class="nh-stats-bubbles">
    <div v-for="b in items" :key="b.key" :class="['nh-bubble', b.cls]">
      <span class="num">{{ fmt(displayed[b.key]) }}</span>
      <span class="label">{{ b.label }}</span>
    </div>
  </div>
</template>
