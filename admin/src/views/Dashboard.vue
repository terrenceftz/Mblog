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
    <div class="page-header mb-3">
      <h1 class="page-title">仪表盘</h1>
    </div>
    <div v-if="error" class="alert alert-danger py-2" role="alert">{{ error }}</div>

    <!-- 统计卡片（Tabler .card 结构） -->
    <div v-if="stats" class="stat-grid stagger">
      <div v-for="card in statCards" :key="card.key" class="card stat-card">
        <div class="card-body d-flex align-items-center gap-3">
          <div class="stat-icon" :style="{ color: card.color, background: card.color + '1a' }">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path :d="card.icon" />
            </svg>
          </div>
          <div class="stat-body">
            <div class="num">{{ (stats as Record<string, number>)[card.key] }}</div>
            <div class="label">{{ card.label }}</div>
          </div>
        </div>
      </div>
      <!-- 待审核评论：可点击跳转 -->
      <router-link
        v-if="stats.pendingComments > 0"
        to="/comments?status=pending"
        class="card stat-card stat-warn text-decoration-none"
      >
        <div class="card-body d-flex align-items-center gap-3">
          <div class="stat-icon stat-icon-warn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>
          <div class="stat-body">
            <div class="num warn-num">{{ stats.pendingComments }}</div>
            <div class="label">待审核评论</div>
          </div>
        </div>
      </router-link>
    </div>
    <div v-else-if="!error" class="stat-grid">
      <div v-for="i in 4" :key="i" class="card"><div class="card-body placeholder-glow"><span class="placeholder col-8"></span></div></div>
    </div>

    <!-- 快捷操作 -->
    <h2 class="quick-title">快捷操作</h2>
    <div class="quick-grid stagger">
      <div
        v-for="action in quickActions"
        :key="action.label"
        class="card quick-card"
        role="button"
        tabindex="0"
        @click="router.push(action.to)"
        @keyup.enter="router.push(action.to)"
      >
        <div class="card-body d-flex flex-column align-items-center gap-2">
          <div class="quick-icon" :style="{ color: action.color, background: action.color + '1a' }">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path :d="action.icon" />
            </svg>
          </div>
          <span>{{ action.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}
.stat-card {
  cursor: default;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.stat-card:hover {
  transform: translateY(-2px);
}
.stat-warn {
  border-color: var(--bs-warning-border-subtle);
  color: inherit;
}
.stat-warn:hover {
  border-color: var(--bs-warning);
}
.stat-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}
.stat-icon-warn {
  color: var(--bs-warning);
  background: rgba(251, 191, 36, 0.12);
}
.stat-body {
  min-width: 0;
}
.num {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.warn-num {
  color: var(--bs-warning);
}
.label {
  color: var(--bs-secondary-color);
  font-size: 12px;
  margin-top: 2px;
}

.quick-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 12px;
}
.quick-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}
.quick-card {
  cursor: pointer;
  text-align: center;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.quick-card:hover {
  transform: translateY(-2px);
}
.quick-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
}
.quick-card span {
  font-size: 13px;
  color: var(--bs-secondary-color);
}
</style>
