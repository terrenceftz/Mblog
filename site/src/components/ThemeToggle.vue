<script setup lang="ts">
import { onMounted, ref } from 'vue';

const props = withDefaults(defineProps<{ variant?: 'text' | 'icon' }>(), { variant: 'text' });
const THEME_KEY = 'mblog_theme';
const current = ref('normal');

function doApply(t: string) {
  current.value = t;
  localStorage.setItem(THEME_KEY, t);
  document.documentElement.setAttribute('data-theme', t);
  window.dispatchEvent(new CustomEvent('mblog-theme-change', { detail: t }));
}
// animate=true：淡出（200ms 遮住布局变化）→ 切换主题 → 淡入；页面加载时不动画
function apply(t: string, animate = true) {
  if (!animate) {
    doApply(t);
    return;
  }
  const html = document.documentElement;
  html.classList.add('theme-switching');
  window.setTimeout(() => {
    doApply(t);
    requestAnimationFrame(() => requestAnimationFrame(() => html.classList.remove('theme-switching')));
  }, 200);
}
function toggle() {
  const cur = document.documentElement.getAttribute('data-theme') ?? current.value;
  apply(cur === 'reader' ? 'normal' : 'reader');
}
// onMounted 内读 localStorage，避免 SSR 期访问 window；同时把保存的主题应用到文档（回访用户加载即生效）
onMounted(() => {
  const saved = localStorage.getItem(THEME_KEY);
  const currentTheme = document.documentElement.getAttribute('data-theme') ?? 'normal';
  current.value = saved ?? currentTheme;
  if (saved && saved !== currentTheme) {
    apply(saved, false);
  }
  window.addEventListener('mblog-theme-change', (e) => {
    current.value = (e as CustomEvent<string>).detail;
  });
});
</script>

<template>
  <button
    class="theme-toggle"
    type="button"
    @click="toggle"
    :aria-label="current === 'normal' ? '切换到极简阅读模式' : '切换到正常模式'"
    :title="current === 'normal' ? '切换到极简阅读模式' : '切换到正常模式'"
  >
    <svg
      v-if="props.variant === 'icon'"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M21.64 13a1 1 0 0 0-1.05-.14 8.05 8.05 0 0 1-3.37.73 8.15 8.15 0 0 1-8.14-8.15 8.59 8.59 0 0 1 .25-2A1 1 0 0 0 8 2.36a10.14 10.14 0 1 0 14 11.69 1 1 0 0 0-.36-1.05z" />
    </svg>
    <template v-else>{{ current === 'normal' ? '阅读模式' : '正常模式' }}</template>
  </button>
</template>

<style scoped>
.theme-toggle {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  border-radius: var(--radius);
  padding: 4px 10px;
  cursor: pointer;
  font-size: 13px;
}
.theme-toggle:hover { color: var(--color-primary); border-color: var(--color-primary); }
</style>
