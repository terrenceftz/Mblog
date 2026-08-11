<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api, type DashboardStats, type Comment, type Talk } from '../api/admin';

const router = useRouter();

const stats = ref<DashboardStats>({
  postCount: 0,
  commentCount: 0,
  pendingComments: 0,
  pendingFriendLinks: 0,
  pendingTalks: 0,
  todayViews: 0,
  monthViews: 0,
});

const recentComments = ref<Comment[]>([]);
const recentTalks = ref<Talk[]>([]);

async function loadData() {
  stats.value = await api.getDashboardStats();
  recentComments.value = (await api.getComments()).slice(0, 4);
  recentTalks.value = (await api.getTalks()).slice(0, 3);
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="dashboard-view">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h2 class="page-title">仪表盘概览</h2>
        <div class="text-muted">欢迎回来，以下是站点的最新统计数据与待办事项</div>
      </div>
      <div class="d-flex gap-2">
        <router-link to="/posts/new" class="btn btn-primary d-flex align-items-center gap-1 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>写文章</span>
        </router-link>
      </div>
    </div>

    <!-- Stats Cards Grid -->
    <div class="row row-cards mb-4">
      <div class="col-sm-6 col-lg-3">
        <div class="card card-sm">
          <div class="card-body">
            <div class="row align-items-center">
              <div class="col-auto">
                <span class="bg-primary text-white avatar">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                </span>
              </div>
              <div class="col">
                <div class="font-weight-medium fs-2 fw-bold">{{ stats.postCount }}</div>
                <div class="text-muted small">文章总数</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-sm-6 col-lg-3">
        <div class="card card-sm">
          <div class="card-body">
            <div class="row align-items-center">
              <div class="col-auto">
                <span class="bg-info text-white avatar">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
                </span>
              </div>
              <div class="col">
                <div class="font-weight-medium fs-2 fw-bold">{{ stats.commentCount }}</div>
                <div class="text-muted small">评论互动</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-sm-6 col-lg-3">
        <div class="card card-sm">
          <div class="card-body">
            <div class="row align-items-center">
              <div class="col-auto">
                <span class="bg-success text-white avatar">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                </span>
              </div>
              <div class="col">
                <div class="font-weight-medium fs-2 fw-bold">{{ stats.todayViews }}</div>
                <div class="text-muted small">今日访问 (PV)</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-sm-6 col-lg-3">
        <div class="card card-sm">
          <div class="card-body">
            <div class="row align-items-center">
              <div class="col-auto">
                <span class="bg-warning text-dark avatar">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </span>
              </div>
              <div class="col">
                <div class="font-weight-medium fs-2 fw-bold">
                  {{ stats.pendingComments + stats.pendingFriendLinks + stats.pendingTalks }}
                </div>
                <div class="text-muted small">待审核总量</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Review Pending Card -->
    <div
      v-if="stats.pendingComments > 0 || stats.pendingFriendLinks > 0 || stats.pendingTalks > 0"
      class="card bg-warning-subtle border-warning border-opacity-50 mb-4"
    >
      <div class="card-body d-flex align-items-center justify-content-between py-3">
        <div class="d-flex align-items-center gap-3">
          <div class="p-2 bg-warning text-dark rounded-circle d-flex align-items-center justify-content-center" style="width: 36px; height: 36px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div>
            <div class="fw-bold text-dark">待审核项目处理提示</div>
            <div class="text-muted small">
              当前有
              <span v-if="stats.pendingComments > 0" class="fw-semibold text-warning-emphasis me-2">{{ stats.pendingComments }} 条评论</span>
              <span v-if="stats.pendingTalks > 0" class="fw-semibold text-warning-emphasis me-2">{{ stats.pendingTalks }} 条说说</span>
              <span v-if="stats.pendingFriendLinks > 0" class="fw-semibold text-warning-emphasis me-2">{{ stats.pendingFriendLinks }} 个友链申请</span>
              等待处理
            </div>
          </div>
        </div>
        <div class="d-flex gap-2">
          <router-link v-if="stats.pendingComments > 0" to="/comments" class="btn btn-sm btn-warning fw-medium">审核评论</router-link>
          <router-link v-if="stats.pendingFriendLinks > 0" to="/friend-links" class="btn btn-sm btn-outline-dark fw-medium">审核友链</router-link>
        </div>
      </div>
    </div>

    <!-- Quick Actions Grid -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title fw-bold">快捷操作</h3>
          </div>
          <div class="card-body">
            <div class="row row-deck g-3">
              <div class="col-md-3 col-6">
                <router-link to="/posts/new" class="card card-action card-link border p-3 text-center text-decoration-none h-100 hover-shadow">
                  <div class="mb-2 text-primary">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  </div>
                  <div class="fw-semibold text-main">新建文章</div>
                  <div class="text-muted micro-text mt-1">撰写并发布新博文</div>
                </router-link>
              </div>

              <div class="col-md-3 col-6">
                <router-link to="/talks" class="card card-action card-link border p-3 text-center text-decoration-none h-100 hover-shadow">
                  <div class="mb-2 text-info">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  </div>
                  <div class="fw-semibold text-main">发布微语/说说</div>
                  <div class="text-muted micro-text mt-1">记录碎片化灵感</div>
                </router-link>
              </div>

              <div class="col-md-3 col-6">
                <router-link to="/settings" class="card card-action card-link border p-3 text-center text-decoration-none h-100 hover-shadow">
                  <div class="mb-2 text-success">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                  </div>
                  <div class="fw-semibold text-main">站点配置</div>
                  <div class="text-muted micro-text mt-1">SEO与豆瓣同步配置</div>
                </router-link>
              </div>

              <div class="col-md-3 col-6">
                <router-link to="/themes" class="card card-action card-link border p-3 text-center text-decoration-none h-100 hover-shadow">
                  <div class="mb-2 text-warning">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>
                  </div>
                  <div class="fw-semibold text-main">主题调色</div>
                  <div class="text-muted micro-text mt-1">切换字号与视觉风格</div>
                </router-link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Comments Section -->
    <div class="row">
      <div class="col-md-7 mb-3">
        <div class="card h-100">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h3 class="card-title fw-bold m-0">最新评论</h3>
            <router-link to="/comments" class="small text-primary text-decoration-none">查看全部</router-link>
          </div>
          <div class="card-body p-0">
            <div class="list-group list-group-flush">
              <div v-for="c in recentComments" :key="c.id" class="list-group-item p-3">
                <div class="d-flex align-items-start gap-3">
                  <img :src="c.avatar" class="avatar rounded-circle" alt="avatar" />
                  <div class="flex-grow-1 min-w-0">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                      <span class="fw-semibold text-main small">{{ c.author }}</span>
                      <span class="text-muted micro-text">{{ c.created_at }}</span>
                    </div>
                    <div class="text-muted small text-truncate mb-1">{{ c.content }}</div>
                    <div class="text-subtle micro-text">源自文章: 《{{ c.postTitle }}》</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-md-5 mb-3">
        <div class="card h-100">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h3 class="card-title fw-bold m-0">最新微语/说说</h3>
            <router-link to="/talks" class="small text-primary text-decoration-none">查看全部</router-link>
          </div>
          <div class="card-body p-3">
            <div class="d-flex flex-column gap-3">
              <div v-for="t in recentTalks" :key="t.id" class="p-3 bg-body-tertiary rounded-3 border">
                <div class="small text-main mb-2" style="white-space: pre-wrap;">{{ t.content }}</div>
                <div class="d-flex justify-content-between align-items-center micro-text text-muted">
                  <span>{{ t.created_at }}</span>
                  <span class="badge badge-soft-primary">👍 {{ t.likeCount }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.micro-text {
  font-size: 0.75rem;
}
.hover-shadow {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.hover-shadow:hover {
  transform: translateY(-2px);
  box-shadow: var(--mb-shadow-dropdown);
}
</style>
