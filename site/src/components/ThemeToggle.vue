<script setup lang="ts">
import { onMounted, ref } from 'vue';

const props = withDefaults(defineProps<{ variant?: 'text' | 'icon' }>(), { variant: 'text' });
const THEME_KEY = 'mblog_theme';
const current = ref('normal');

function apply(t: string) {
  current.value = t;
  localStorage.setItem(THEME_KEY, t);
  document.documentElement.setAttribute('data-theme', t);
  window.dispatchEvent(new CustomEvent('mblog-theme-change', { detail: t }));
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
    apply(saved);
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
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a10 10 0 0 0 0 20z" />
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
