<script setup lang="ts">
// 文章点赞：原子自增（后端限流），localStorage 防止重复点赞
import { onMounted, ref } from 'vue';

const props = defineProps<{ slug: string; initialCount: number }>();
const count = ref(props.initialCount);
const liked = ref(false);
const loading = ref(false);

onMounted(() => {
  try {
    if (localStorage.getItem(`mblog_liked_${props.slug}`)) liked.value = true;
  } catch {
    /* localStorage 不可用忽略 */
  }
});

async function like() {
  if (liked.value || loading.value) return;
  loading.value = true;
  try {
    const res = await fetch(`/api/posts/${props.slug}/like`, { method: 'POST' });
    if (res.ok) {
      const body = await res.json();
      count.value = body.data.likeCount;
      liked.value = true;
      try {
        localStorage.setItem(`mblog_liked_${props.slug}`, '1');
      } catch {
        /* 忽略 */
      }
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <button
    type="button"
    class="like-btn"
    :class="{ liked }"
    :disabled="loading"
    :aria-label="liked ? '已点赞' : '点赞'"
    :title="liked ? '已点赞' : '点赞'"
    @click="like"
  >
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 21s-6.72-4.35-9.42-8.01C.66 10.32-.15 6.95 1.76 4.4 3.53 2.06 6.75 1.57 9 3.23c.82.6 1.48 1.42 3 3.23 1.52-1.81 2.18-2.63 3-3.23 2.25-1.66 5.47-1.17 7.24 1.17 1.91 2.55 1.1 5.92-1.82 8.59C18.72 16.65 12 21 12 21z"/>
    </svg>
    <span class="like-count">{{ count }}</span>
  </button>
</template>

<style scoped>
.like-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-muted);
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
}
.like-btn:hover {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.5);
}
.like-btn.liked {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.55);
  background: rgba(248, 113, 113, 0.1);
}
.like-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.like-count {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
</style>
