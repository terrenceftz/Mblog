<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getStats } from '../api/admin';

const stats = ref<Awaited<ReturnType<typeof getStats>> | null>(null);

onMounted(async () => {
  stats.value = await getStats();
});
</script>

<template>
  <div>
    <h1 class="page-title">仪表盘</h1>
    <div v-if="stats" class="stat-grid">
      <div class="stat-card"><div class="num">{{ stats.postTotal }}</div><div class="label">文章总数</div></div>
      <div class="stat-card"><div class="num">{{ stats.published }}</div><div class="label">已发布</div></div>
      <div class="stat-card"><div class="num">{{ stats.commentTotal }}</div><div class="label">评论总数</div></div>
      <div class="stat-card warn"><div class="num">{{ stats.pendingComments }}</div><div class="label">待审核评论</div></div>
      <div class="stat-card"><div class="num">{{ stats.totalViews }}</div><div class="label">总阅读量</div></div>
    </div>
    <p v-else class="loading">加载中…</p>
  </div>
</template>

<style scoped>
.page-title { font-size: 22px; margin-bottom: 20px; }
.stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 14px; }
.stat-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; text-align: center; }
.stat-card .num { font-size: 28px; font-weight: 700; }
.stat-card.warn .num { color: #d97706; }
.stat-card .label { color: #6b7280; font-size: 13px; margin-top: 4px; }
.loading { color: #6b7280; }
</style>
