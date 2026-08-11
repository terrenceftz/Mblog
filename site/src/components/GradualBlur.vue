<script setup lang="ts">
// GradualBlur（reactbits 移植）：多层 backdrop-filter + 渐变遮罩，形成渐进模糊
// 应用为固定视口底部时：页面滚动时底部内容从清晰→渐进模糊（电影感散场）
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    position?: 'top' | 'bottom' | 'left' | 'right';
    strength?: number;
    height?: string;
    width?: string;
    divCount?: number;
    exponential?: boolean;
    zIndex?: number;
    animated?: boolean | 'scroll';
    duration?: string;
    easing?: string;
    opacity?: number;
    curve?: 'linear' | 'bezier' | 'ease-in' | 'ease-out' | 'ease-in-out';
    target?: 'parent' | 'page';
  }>(),
  {
    position: 'bottom',
    strength: 2,
    height: '8rem',
    width: '',
    divCount: 6,
    exponential: false,
    zIndex: 50,
    animated: 'scroll',
    duration: '0.3s',
    easing: 'ease-out',
    opacity: 1,
    curve: 'ease-out',
    target: 'parent',
  },
);

const CURVE: Record<string, (p: number) => number> = {
  linear: (p) => p,
  bezier: (p) => p * p * (3 - 2 * p),
  'ease-in': (p) => p * p,
  'ease-out': (p) => 1 - Math.pow(1 - p, 2),
  'ease-in-out': (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2),
};
const DIR: Record<string, string> = {
  top: 'to top',
  bottom: 'to bottom',
  left: 'to left',
  right: 'to right',
};
const gradientDir = computed(() => DIR[props.position] ?? 'to bottom');

const containerRef = ref<HTMLElement | null>(null);
const isVisible = ref(props.animated !== 'scroll');
let observer: IntersectionObserver | null = null;
onMounted(() => {
  if (props.animated === 'scroll' && containerRef.value) {
    observer = new IntersectionObserver(([entry]) => {
      isVisible.value = entry.isIntersecting;
    }, { threshold: 0.1 });
    observer.observe(containerRef.value);
  }
});
onBeforeUnmount(() => observer?.disconnect());

interface Layer { key: number; mask: string; blur: string }
const blurDivs = computed<Layer[]>(() => {
  const layers: Layer[] = [];
  const inc = 100 / props.divCount;
  const curve = CURVE[props.curve] ?? CURVE.linear;
  for (let i = 1; i <= props.divCount; i++) {
    const progress = curve(i / props.divCount);
    const blur =
      props.exponential
        ? Math.pow(2, progress * 4) * 0.0625 * props.strength
        : 0.0625 * (progress * props.divCount + 1) * props.strength;
    const p1 = Math.round((inc * i - inc) * 10) / 10;
    const p2 = Math.round(inc * i * 10) / 10;
    const p3 = Math.round((inc * i + inc) * 10) / 10;
    const p4 = Math.round((inc * i + inc * 2) * 10) / 10;
    let g = `transparent ${p1}%, black ${p2}%`;
    if (p3 <= 100) g += `, black ${p3}%`;
    if (p4 <= 100) g += `, transparent ${p4}%`;
    layers.push({ key: i, mask: `linear-gradient(${gradientDir.value}, ${g})`, blur: `${blur.toFixed(3)}rem` });
  }
  return layers;
});

const containerStyle = computed<Record<string, string>>(() => {
  const isPage = props.target === 'page';
  const isVertical = props.position === 'top' || props.position === 'bottom';
  const s: Record<string, string> = {
    position: isPage ? 'fixed' : 'absolute',
    pointerEvents: 'none',
    opacity: isVisible.value ? '1' : '0',
    transition: props.animated ? `opacity ${props.duration} ${props.easing}` : 'none',
    zIndex: String(props.zIndex),
  };
  if (isVertical) {
    s.height = props.height;
    s.width = props.width || '100%';
    s.left = '0';
    s.right = '0';
    s[props.position] = '0';
  } else {
    s.width = props.width || props.height;
    s.height = '100%';
    s.top = '0';
    s.bottom = '0';
    s[props.position] = '0';
  }
  return s;
});
</script>

<template>
  <div ref="containerRef" class="gradual-blur" :style="containerStyle" aria-hidden="true">
    <div class="gradual-blur-inner">
      <div
        v-for="d in blurDivs"
        :key="d.key"
        class="gradual-blur-layer"
        :style="{
          maskImage: d.mask,
          WebkitMaskImage: d.mask,
          backdropFilter: `blur(${d.blur})`,
          WebkitBackdropFilter: `blur(${d.blur})`,
          opacity: String(props.opacity),
        }"
      />
    </div>
  </div>
</template>

<style scoped>
.gradual-blur {
  isolation: isolate;
}
.gradual-blur-inner {
  position: relative;
  width: 100%;
  height: 100%;
}
.gradual-blur-layer {
  position: absolute;
  inset: 0;
}
@supports not (backdrop-filter: blur(1px)) {
  .gradual-blur-layer {
    background: rgba(0, 0, 0, 0.3);
    opacity: 0.5;
  }
}
</style>
