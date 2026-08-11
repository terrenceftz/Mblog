<script setup lang="ts">
import { toasts, removeToast } from '../lib/toast';
</script>

<template>
  <div class="toast-container position-fixed top-0 end-0 p-3" style="z-index: 1090">
    <TransitionGroup name="toast-fade">
      <div
        v-for="item in toasts"
        :key="item.id"
        class="toast show mb-2 shadow-sm align-items-center border-0"
        :class="{
          'bg-success text-white': item.type === 'success',
          'bg-danger text-white': item.type === 'error',
          'bg-warning text-dark': item.type === 'warning',
          'bg-info text-white': item.type === 'info',
        }"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        <div class="d-flex">
          <div class="toast-body py-2 px-3">
            <div v-if="item.title" class="fw-bold mb-1">{{ item.title }}</div>
            <div>{{ item.message }}</div>
          </div>
          <button
            type="button"
            class="btn-close btn-close-white me-2 m-auto"
            @click="removeToast(item.id)"
            aria-label="Close"
          ></button>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 0.25s ease;
}
.toast-fade-enter-from {
  opacity: 0;
  transform: translateX(30px);
}
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
