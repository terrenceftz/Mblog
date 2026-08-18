<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { getThemeMode, applyTheme, type ThemeMode } from '../lib/theme';
import { api } from '../api/admin';
import ToastContainer from '../components/ToastContainer.vue';

const router = useRouter();
const route = useRoute();

const currentTheme = ref<ThemeMode>(getThemeMode());
const pendingBadges = ref({
  comments: 0,
  talks: 0,
  links: 0,
});

const navItems = [
  {
    name: '仪表盘',
    path: '/dashboard',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>`,
  },
  {
    name: '文章管理',
    path: '/posts',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`,
  },
  {
    name: '分类管理',
    path: '/categories',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>`,
  },
  {
    name: '标签管理',
    path: '/tags',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><circle cx="7" cy="7" r="1.5"/></svg>`,
  },
  {
    name: '评论管理',
    path: '/comments',
    badgeKey: 'comments',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`,
  },
  {
    name: '说说管理',
    path: '/talks',
    badgeKey: 'talks',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  },
  {
    name: '相册管理',
    path: '/photos',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>`,
  },
  {
    name: '友链管理',
    path: '/friends',
    badgeKey: 'links',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  },
  {
    name: '站点设置',
    path: '/settings',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
  },
  {
    name: '主题配置',
    path: '/themes',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>`,
  },
  {
    name: '操作日志',
    path: '/audit-log',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>`,
  },
];

function switchTheme(mode: ThemeMode) {
  currentTheme.value = mode;
  applyTheme(mode);
}

async function loadBadges() {
  const stats = await api.getDashboardStats();
  pendingBadges.value.comments = stats.pendingComments;
  pendingBadges.value.talks = stats.pendingTalks;
  pendingBadges.value.links = stats.pendingFriendLinks;
}

async function handleLogout() {
  await api.logout();
  router.push('/login');
}

onMounted(() => {
  loadBadges();
});
</script>

<template>
  <div class="page">
    <ToastContainer />

    <!-- Sidebar Navbar -->
    <aside class="navbar navbar-vertical navbar-expand-lg border-end">
      <div class="container-fluid px-3">
        <!-- Brand -->
        <h1 class="navbar-brand navbar-brand-autodark pt-3 pb-3 my-0">
          <router-link to="/dashboard" class="d-flex align-items-center gap-2 text-decoration-none">
            <div class="bg-warning text-dark fw-bold rounded-2 d-flex align-items-center justify-content-center shadow-sm" style="width: 32px; height: 32px;">
              M
            </div>
            <span class="fs-3 fw-bold text-reset tracking-tight">MBLOG Admin</span>
          </router-link>
        </h1>

        <!-- Quick Post Button -->
        <div class="my-2 w-100">
          <router-link to="/posts/new" class="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2 py-2 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            <span>发布新文章</span>
          </router-link>
        </div>

        <!-- Vertical Nav Links (9 items) -->
        <div class="collapse navbar-collapse show id-navbar-menu mt-2">
          <ul class="navbar-nav pt-lg-2 w-100">
            <li v-for="item in navItems" :key="item.path" class="nav-item mb-1">
              <router-link
                :to="item.path"
                class="nav-link d-flex align-items-center justify-content-between px-3 py-2 rounded"
                :class="{ active: route.path.startsWith(item.path) }"
              >
                <div class="d-flex align-items-center gap-2">
                  <span class="nav-link-icon d-inline-flex" v-html="item.icon"></span>
                  <span class="nav-link-title">{{ item.name }}</span>
                </div>
                <!-- Badge if pending -->
                <span
                  v-if="item.badgeKey && pendingBadges[item.badgeKey as keyof typeof pendingBadges] > 0"
                  class="badge bg-warning-subtle text-warning fw-semibold rounded-pill px-2 py-1 small"
                >
                  {{ pendingBadges[item.badgeKey as keyof typeof pendingBadges] }}
                </span>
              </router-link>
            </li>
          </ul>
        </div>

        <!-- Sidebar Footer Theme Switcher & User -->
        <div class="mt-auto pt-3 border-top w-100 pb-3">
          <!-- 3-State Theme Switcher -->
          <div class="mb-3 px-1">
            <div class="small text-muted mb-2 font-monospace">界面主题</div>
            <div class="btn-group w-100 p-1 bg-body-tertiary rounded-3 border" role="group">
              <button
                type="button"
                class="btn btn-sm border-0 rounded-2 d-flex align-items-center justify-content-center py-1"
                :class="currentTheme === 'light' ? 'btn-primary shadow-xs' : 'btn-ghost-secondary text-muted'"
                @click="switchTheme('light')"
                title="浅色模式"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
              </button>
              <button
                type="button"
                class="btn btn-sm border-0 rounded-2 d-flex align-items-center justify-content-center py-1"
                :class="currentTheme === 'dark' ? 'btn-primary shadow-xs' : 'btn-ghost-secondary text-muted'"
                @click="switchTheme('dark')"
                title="暗色模式"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
              </button>
              <button
                type="button"
                class="btn btn-sm border-0 rounded-2 d-flex align-items-center justify-content-center py-1"
                :class="currentTheme === 'system' ? 'btn-primary shadow-xs' : 'btn-ghost-secondary text-muted'"
                @click="switchTheme('system')"
                title="跟随系统"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
              </button>
            </div>
          </div>

          <!-- User Card & Logout -->
          <div class="d-flex align-items-center justify-content-between px-1">
            <div class="d-flex align-items-center gap-2 min-w-0">
              <img src="https://api.dicebear.com/7.x/bottts/svg?seed=Terrence" class="avatar avatar-sm rounded-circle" alt="User" />
              <div class="min-w-0">
                <div class="fw-semibold text-truncate small">Terrence</div>
                <div class="text-muted text-truncate micro-text">管理员</div>
              </div>
            </div>
            <button @click="handleLogout" class="btn btn-sm btn-icon btn-ghost-danger rounded-circle" title="退出登录">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content Wrapper -->
    <div class="page-wrapper">
      <div class="container-xl py-4">
        <router-view />
      </div>
    </div>
  </div>
</template>

<style scoped>
.micro-text {
  font-size: 0.725rem;
}
</style>
