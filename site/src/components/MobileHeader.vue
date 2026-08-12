<script setup lang="ts">
// 移动端导航：顶部栏（站名 + 汉堡）+ 滑出菜单面板（双主题通用，≤768px 显示）
// 支持双主题各自菜单：SSR 按 initialTheme 渲染，主题切换时同步更新
import { ref, onMounted, onBeforeUnmount } from 'vue';
import ThemeToggle from './ThemeToggle.vue';

const props = defineProps<{
  normalItems: { label: string; url: string }[];
  readerItems: { label: string; url: string }[];
  siteName: string;
  initialTheme?: string;
}>();
const open = ref(false);
const currentItems = ref(props.initialTheme === 'reader' ? props.readerItems : props.normalItems);
const isExternal = (u: string) => u.startsWith('http');

function close() {
  open.value = false;
}
function syncItems() {
  const theme = document.documentElement.getAttribute('data-theme') ?? props.initialTheme ?? 'normal';
  currentItems.value = theme === 'reader' ? props.readerItems : props.normalItems;
}
// Escape 关闭菜单（键盘可达性）
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) close();
}
onMounted(() => {
  syncItems();
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('mblog-theme-change', syncItems);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('mblog-theme-change', syncItems);
});
</script>

<template>
  <div class="mobile-header">
    <div class="mobile-topbar">
      <a class="mobile-brand" href="/" @click="close">{{ props.siteName }}</a>
      <button
        type="button"
        class="mobile-hamburger"
        :class="{ open }"
        :aria-expanded="open"
        aria-label="菜单"
        @click="open = !open"
      >
        <span class="bar" /><span class="bar" /><span class="bar" />
      </button>
    </div>

    <Transition name="menu">
      <nav v-if="open" class="mobile-menu" @click.self="close">
        <a
          v-for="item in currentItems"
          :key="item.url"
          class="mobile-link"
          :href="item.url"
          :target="isExternal(item.url) ? '_blank' : undefined"
          :rel="isExternal(item.url) ? 'noopener noreferrer' : undefined"
          @click="close"
        >{{ item.label }}</a>
        <div class="mobile-menu-foot">
          <ThemeToggle variant="icon" />
        </div>
      </nav>
    </Transition>
  </div>
</template>

<style scoped>
.mobile-topbar {
  position: sticky;
  top: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 18px;
  background: color-mix(in srgb, var(--color-surface) 92%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--color-border);
}
.mobile-brand {
  font-weight: 700;
  font-size: 16px;
  color: var(--color-text-heading);
  text-decoration: none;
}
.mobile-hamburger {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 38px;
  height: 38px;
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
}
.mobile-hamburger .bar {
  display: block;
  height: 2px;
  width: 100%;
  border-radius: 2px;
  background: var(--color-text);
  transition: transform 0.25s ease, opacity 0.2s ease;
}
.mobile-hamburger.open .bar:nth-child(1) {
  transform: translateY(7px) rotate(45deg);
}
.mobile-hamburger.open .bar:nth-child(2) {
  opacity: 0;
}
.mobile-hamburger.open .bar:nth-child(3) {
  transform: translateY(-7px) rotate(-45deg);
}
.mobile-menu {
  position: fixed;
  top: 56px;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 95;
  background: color-mix(in srgb, var(--color-bg) 96%, transparent);
  backdrop-filter: blur(10px);
  overflow-y: auto;
  padding: 12px 18px 40px;
}
.mobile-link {
  display: block;
  padding: 14px 6px;
  font-size: 16px;
  color: var(--color-text);
  text-decoration: none;
  border-bottom: 1px solid var(--color-border);
}
.mobile-link:active,
.mobile-link:hover {
  color: var(--color-primary);
}
.mobile-menu-foot {
  display: flex;
  justify-content: center;
  padding-top: 24px;
}
.menu-enter-active,
.menu-leave-active {
  transition: opacity 0.2s ease;
}
.menu-enter-from,
.menu-leave-to {
  opacity: 0;
}
</style>
