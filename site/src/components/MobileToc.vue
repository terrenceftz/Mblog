<script setup lang="ts">
// 移动端目录抽屉：窄屏右下角悬浮按钮，点击滑出目录
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';

const props = defineProps<{ items: { id: string; text: string; level: number }[] }>();
const open = ref(false);
const closeBtn = ref<HTMLElement | null>(null);
const sheetEl = ref<HTMLElement | null>(null);
let restoreFocus: HTMLElement | null = null;
let goTimer: number | undefined;

function openMenu() {
  restoreFocus = document.activeElement as HTMLElement;
  open.value = true;
  // 焦点移入对话框，便于键盘操作
  nextTick(() => closeBtn.value?.focus());
}
function close() {
  open.value = false;
  if (goTimer) {
    clearTimeout(goTimer);
    goTimer = undefined;
  }
  restoreFocus?.focus?.();
  restoreFocus = null;
}
function toggle() {
  open.value ? close() : openMenu();
}
function go(id: string) {
  open.value = false;
  if (goTimer) clearTimeout(goTimer);
  goTimer = window.setTimeout(() => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 80);
}
// Escape 关闭 + Tab 焦点陷阱（dialog 可达性）
function onKeydown(e: KeyboardEvent) {
  if (!open.value) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    close();
    return;
  }
  if (e.key === 'Tab' && sheetEl.value) {
    const focusables = sheetEl.value.querySelectorAll<HTMLElement>(
      'button, a, input, [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  if (goTimer) clearTimeout(goTimer);
});
</script>

<template>
  <div class="mobile-toc">
    <button
      type="button"
      class="mobile-toc-btn"
      :aria-expanded="open"
      aria-label="打开目录"
      @click="toggle"
    >目录</button>

    <Transition name="toc-fade">
      <div v-if="open" class="mobile-toc-backdrop" @click="close" />
    </Transition>
    <Transition name="toc-sheet">
      <div v-if="open" ref="sheetEl" class="mobile-toc-sheet" role="dialog" aria-modal="true" aria-label="文章目录">
        <div class="mobile-toc-head">
          <span class="mobile-toc-title">目录</span>
          <button type="button" ref="closeBtn" class="mobile-toc-close" aria-label="关闭目录" @click="close">✕</button>
        </div>
        <ul class="mobile-toc-list">
          <li v-for="(t, i) in items" :key="t.id" :class="{ 'is-h3': t.level === 3 }">
            <button type="button" class="mobile-toc-link" @click="go(t.id)">
              <span class="mobile-toc-idx">{{ String(i + 1).padStart(2, '0') }}</span>
              <span class="mobile-toc-text">{{ t.text }}</span>
            </button>
          </li>
        </ul>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.mobile-toc {
  display: none;
}
@media (max-width: 1100px) {
  .mobile-toc {
    display: block;
  }
  .mobile-toc-btn {
    position: fixed;
    right: 18px;
    bottom: 20px;
    z-index: 90;
    border: 1px solid var(--color-border-strong);
    background: var(--color-surface);
    color: var(--color-text);
    border-radius: 999px;
    padding: 10px 20px;
    font-size: 14px;
    cursor: pointer;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
    transition: border-color 0.2s ease, color 0.2s ease;
  }
  .mobile-toc-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
  .mobile-toc-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 100;
  }
  .mobile-toc-sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 110;
    background: var(--color-surface);
    border-top: 1px solid var(--color-border);
    border-radius: 16px 16px 0 0;
    max-height: 60vh;
    overflow-y: auto;
    padding: 16px 20px 24px;
  }
  .mobile-toc-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  .mobile-toc-title {
    font-size: 13px;
    letter-spacing: 0.15em;
    color: var(--color-text-muted);
    font-weight: 600;
  }
  .mobile-toc-close {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 16px;
    cursor: pointer;
  }
  .mobile-toc-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .mobile-toc-link {
    display: flex;
    align-items: baseline;
    gap: 10px;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    color: var(--color-text-muted);
    padding: 8px 6px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    line-height: 1.5;
  }
  .mobile-toc-link:hover {
    color: var(--color-text-heading);
    background: var(--color-accent-subtle);
  }
  .mobile-toc-idx {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-primary);
  }
  .is-h3 .mobile-toc-link {
    padding-left: 24px;
    font-size: 13px;
  }
}
.toc-fade-enter-active,
.toc-fade-leave-active {
  transition: opacity 0.2s ease;
}
.toc-fade-enter-from,
.toc-fade-leave-to {
  opacity: 0;
}
.toc-sheet-enter-active,
.toc-sheet-leave-active {
  transition: transform 0.25s ease;
}
.toc-sheet-enter-from,
.toc-sheet-leave-to {
  transform: translateY(100%);
}
</style>
