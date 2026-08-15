<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

// BlurText：逐词「模糊 → 清晰」揭示动效（移植自 reactbits.dev）
// 中文用 Intl.Segmenter 分词；渲染为内联 <span>，由外层元素（h1/p）控制排版
const props = withDefaults(
  defineProps<{
    text: string;
    /** 首词前的基础延迟 ms（用于多段文字级联） */
    startDelay?: number;
    /** 每词间隔 ms */
    delay?: number;
    /** 单步时长（秒） */
    stepDuration?: number;
    direction?: 'top' | 'bottom';
  }>(),
  { startDelay: 0, delay: 80, stepDuration: 0.35, direction: 'top' },
);

const words = computed(() => {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const seg = new Intl.Segmenter('zh-CN', { granularity: 'word' });
    return [...seg.segment(props.text)]
      .filter((s) => s.isWordLike || s.segment !== ' ')
      .map((s) => s.segment)
      .filter((w) => w.trim().length > 0);
  }
  return props.text.split(' ').filter(Boolean);
});

const el = ref<HTMLElement | null>(null);

onMounted(() => {
  const root = el.value;
  if (!root) return;
  // 「减少动态」用户：SSR HTML 本就可见，直接跳过逐词入场（对齐项目智能降级约定）
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const nodes = [...root.querySelectorAll<HTMLElement>('.blur-text-word')];
  const fromY = props.direction === 'top' ? -50 : 50;
  nodes.forEach((w, i) => {
    // will-change 仅动画期间生效，结束即回收（常驻会白占合成层内存）
    w.style.willChange = 'transform, filter, opacity';
    const anim = w.animate(
      [
        { filter: 'blur(10px)', opacity: 0, transform: `translateY(${fromY}px)` },
        { filter: 'blur(5px)', opacity: 0.5, transform: `translateY(${fromY === -50 ? 5 : -5}px)` },
        { filter: 'blur(0px)', opacity: 1, transform: 'translateY(0px)' },
      ],
      {
        duration: props.stepDuration * 2 * 1000,
        delay: props.startDelay + i * props.delay,
        easing: 'cubic-bezier(0.33, 1, 0.68, 1)',
        fill: 'both',
      },
    );
    anim.onfinish = () => {
      w.style.willChange = '';
    };
  });
});
</script>

<template>
  <span ref="el" class="blur-text">
    <template v-for="(word, i) in words" :key="i">
      <span class="blur-text-word">{{ word }}</span>{{ i < words.length - 1 ? ' ' : '' }}
    </template>
  </span>
</template>
