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
      <path d="M12 2a10 10 0 1 0 0 20c1.1 0 2-.9 2-2v-.5a2.5 2.5 0 0 1 4.4-1.5c.4.4 1 .6 1.6.6 1.1 0 2-.9 2-2A10 10 0 0 0 12 2zm-6.5 10.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3.5-4.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm4-1a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm4.5 2.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
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
