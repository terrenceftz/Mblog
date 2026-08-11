<script setup lang="ts">
import { onMounted } from 'vue';
import { initTheme } from './lib/theme';

onMounted(() => {
  initTheme();
});
</script>

<template>
  <router-view />
</template>
