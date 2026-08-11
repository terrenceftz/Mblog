<script setup lang="ts">
// 全局轻提示容器（配合 lib/toast.ts）
import { toasts } from '../lib/toast';
</script>

<template>
  <div class="toast-container" aria-live="polite">
    <div v-for="t in toasts" :key="t.id" class="toast" :class="t.type">{{ t.message }}</div>
  </div>
</template>
