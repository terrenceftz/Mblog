<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getStats } from '../api/admin';

const router = useRouter();
const stats = ref<Awaited<ReturnType<typeof getStats>> | null>(null);
const error = ref('');

const statCards = [
  { key: 'postTotal', label: '文章总数', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6', color: '#e8b64c' },
  { key: 'published', label: '已发布', icon: 'M9 12l2 2 4-4M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z', color: '#34d399' },
  { key: 'commentTotal', label: '评论总数', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', color: '#7c9cf5' },
  { key: 'totalViews', label: '总阅读量', icon: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', color: '#f472b6' },
];

const quickActions = [
  { label: '新建文章', to: '/posts/new', icon: 'M12 5v14M5 12h14', color: '#e8b64c' },
  { label: '审核评论', to: '/comments?status=pending', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', color: '#fbbf24' },
  { label: '写说说', to: '/talks', icon: 'M12 2a10 10 0 0 0-8.66 15L2 22l5.1-1.34A10 10 0 1 0 12 2z', color: '#7c9cf5' },
  { label: '站点设置', to: '/settings', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', color: '#f472b6' },
];

onMounted(async () => {
  try {
    stats.value = await getStats();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败';
  }
});
</script>

<template>
  <div>
    <h1 class="page-title">仪表盘</h1>
    <p v-if="error" class="error">{{ error }}</p>

    <!-- 统计卡片 -->
    <div v-if="stats" class="stat-grid">
      <div v-for="card in statCards" :key="card.key" class="card stat-card">
        <div class="stat-icon" :style="{ color: card.color }">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path :d="card.icon" />
          </svg>
        </div>
        <div class="stat-body">
          <div class="num">{{ (stats as Record<string, number>)[card.key] }}</div>
          <div class="label">{{ card.label }}</div>
        </div>
      </div>
      <!-- 待审核评论：可点击跳转 -->
      <router-link v-if="stats.pendingComments > 0" to="/comments?status=pending" class="card stat-card stat-warn">
        <div class="stat-icon" style="color: #fbbf24">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
        </div>
        <div class="stat-body">
          <div class="num warn-num">{{ stats.pendingComments }}</div>
          <div class="label">待审核评论</div>
        </div>
      </router-link>
    </div>
    <p v-else-if="!error" class="loading">加载中…</p>

    <!-- 快捷操作 -->
    <div class="quick-section">
      <h2 class="quick-title">快捷操作</h2>
      <div class="quick-grid">
        <button
          v-for="action in quickActions"
          :key="action.label"
          class="card quick-card"
          @click="router.push(action.to)"
        >
          <div class="quick-icon" :style="{ color: action.color }">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path :d="action.icon" />
            </svg>
          </div>
          <span>{{ action.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
  margin-bottom: 32px;
}
.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 16px;
  transition: border-color 0.2s ease, transform 0.15s ease;
}
.stat-card:hover {
  transform: translateY(-1px);
}
.stat-warn {
  display: flex;
  text-decoration: none;
  color: inherit;
  border-color: rgba(251, 191, 36, 0.4);
}
.stat-warn:hover {
  border-color: #fbbf24;
}
.stat-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
}
.stat-body { min-width: 0; }
.stat-card .num {
  font-size: 26px;
  font-weight: 700;
  color: #fafafa;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.warn-num { color: #fbbf24; }
.stat-card .label {
  color: var(--text-muted);
  font-size: 12px;
  margin-top: 2px;
}

.quick-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 14px;
}
.quick-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}
.quick-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px 14px;
  text-align: center;
  border: 1px solid var(--border);
  cursor: pointer;
  font: inherit;
  color: var(--text-muted);
  transition: border-color 0.2s ease, transform 0.15s ease, color 0.2s ease;
}
.quick-card:hover {
  border-color: var(--border-strong);
  transform: translateY(-2px);
  color: var(--text);
}
.quick-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
}
.quick-card span {
  font-size: 13px;
}
</style>
