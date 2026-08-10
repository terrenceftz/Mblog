<script setup lang="ts">
import { onMounted, ref } from 'vue';

const THEME_KEY = 'mblog_theme';
const current = ref('normal');

function apply(t: string) {
  current.value = t;
  localStorage.setItem(THEME_KEY, t);
  document.documentElement.setAttribute('data-theme', t);
}
function toggle() {
  apply(current.value === 'normal' ? 'reader' : 'normal');
}
// onMounted 内读 localStorage，避免 SSR 期访问 window
onMounted(() => {
  current.value =
    localStorage.getItem(THEME_KEY) ??
    document.documentElement.getAttribute('data-theme') ??
    'normal';
});
</script>

<template>
  <button class="theme-toggle" type="button" @click="toggle">
    {{ current === 'normal' ? '📖 阅读模式' : '🌐 正常模式' }}
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
