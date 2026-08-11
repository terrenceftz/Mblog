<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { logout } from '../api/admin';
import { getThemeChoice, setThemeChoice, type ThemeChoice } from '../lib/theme';
import ToastContainer from '../components/ToastContainer.vue';

const route = useRoute();
const router = useRouter();
const menuOpen = ref(false);

// 主题切换：三态循环 dark → light → auto → dark
const themeChoice = ref<ThemeChoice>(getThemeChoice());
const themeLabel = computed(() =>
  themeChoice.value === 'dark' ? '暗色' : themeChoice.value === 'light' ? '浅色' : '跟随系统'
);
const themeIcon = computed(() =>
  themeChoice.value === 'light'
    ? 'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12z'
    : themeChoice.value === 'dark'
    ? 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'
    : 'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'
);
function cycleTheme() {
  const next: ThemeChoice =
    themeChoice.value === 'dark' ? 'light' : themeChoice.value === 'light' ? 'auto' : 'dark';
  themeChoice.value = next;
  setThemeChoice(next);
}

function doLogout() {
  logout();
  router.push('/login');
}

// 精确激活判断：仪表盘(/)仅当恰好在首页时高亮，避免「/」匹配所有路径
function isActive(to: string): boolean {
  return to === '/' ? route.path === '/' : route.path.startsWith(to);
}

const navItems = [
  { to: '/', label: '仪表盘', icon: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z' },
  { to: '/posts', label: '文章', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h6' },
  { to: '/categories', label: '分类', icon: 'M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z' },
  { to: '/tags', label: '标签', icon: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01' },
  { to: '/comments', label: '评论', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { to: '/talks', label: '说说', icon: 'M12 2a10 10 0 0 0-8.66 15L2 22l5.1-1.34A10 10 0 1 0 12 2z' },
  { to: '/friends', label: '友链', icon: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' },
  { to: '/settings', label: '设置', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.14-1.4l2-1.56-2-3.46-2.36.95a7.4 7.4 0 0 0-2.42-1.4L14.2 2h-4l-.28 2.13a7.4 7.4 0 0 0-2.42 1.4L5.14 4.58l-2 3.46 2 1.56a7.4 7.4 0 0 0 0 2.8l-2 1.56 2 3.46 2.36-.95a7.4 7.4 0 0 0 2.42 1.4L10.2 22h4l.28-2.13a7.4 7.4 0 0 0 2.42-1.4l2.36.95 2-3.46-2-1.56c.08-.46.14-.93.14-1.4z' },
  { to: '/themes', label: '主题', icon: 'M12 2a10 10 0 1 0 0 20c1.1 0 2-.9 2-2v-.5a2.5 2.5 0 0 1 4.4-1.5c.4.4 1 .6 1.6.6 1.1 0 2-.9 2-2A10 10 0 0 0 12 2z' },
];
</script>

<template>
  <div class="layout-fluid">
    <!-- 移动端顶栏 -->
    <div class="admin-topbar">
      <div class="admin-brand-sm">MBLOG</div>
      <button
        type="button"
        class="admin-hamburger"
        :class="{ open: menuOpen }"
        :aria-expanded="menuOpen"
        aria-label="菜单"
        @click="menuOpen = !menuOpen"
      >
        <span class="bar" /><span class="bar" /><span class="bar" />
      </button>
    </div>

    <!-- 侧栏（Tabler navbar-vertical 结构，移动端为抽屉） -->
    <aside class="navbar navbar-vertical navbar-expand-lg" :class="{ open: menuOpen }">
      <div class="container">
        <div class="admin-brand navbar-brand navbar-brand-autodark">MBLOG 后台</div>
        <div class="collapse navbar-collapse" :class="{ show: menuOpen }">
          <ul class="navbar-nav">
            <li v-for="item in navItems" :key="item.to" class="nav-item">
              <router-link
                :to="item.to"
                class="nav-link"
                :class="{ active: isActive(item.to) }"
                @click="menuOpen = false"
              >
                <span class="nav-link-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path :d="item.icon" />
                  </svg>
                </span>
                <span class="nav-link-title">{{ item.label }}</span>
              </router-link>
            </li>
          </ul>

          <!-- 侧栏底部操作区 -->
          <div class="admin-actions">
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm w-100"
              :title="'主题：' + themeLabel + '（点击切换）'"
              :aria-label="'切换主题，当前' + themeLabel"
              @click="cycleTheme"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path :d="themeIcon" />
              </svg>
              <span class="ms-2">{{ themeLabel }}</span>
            </button>
            <a class="btn btn-outline-secondary btn-sm w-100" href="http://localhost:4321/" target="_blank" rel="noopener noreferrer">
              ← 查看站点
            </a>
            <button type="button" class="btn btn-outline-danger btn-sm w-100" @click="doLogout">退出登录</button>
          </div>
        </div>
      </div>
    </aside>
    <div v-if="menuOpen" class="admin-mask" @click="menuOpen = false" />

    <!-- 主内容区（Tabler page-wrapper） -->
    <div class="page-wrapper">
      <div class="page-body">
        <div class="container-xl"><router-view /></div>
      </div>
    </div>
    <ToastContainer />
  </div>
</template>

<style scoped>
/* ---------- 布局壳：layout-fluid + page-wrapper（Tabler 类接管主样式） ---------- */
.layout-fluid {
  display: flex;
  min-height: 100vh;
}

.page-wrapper {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.page-body {
  flex: 1;
  padding: var(--space-6) 0;
}
.page-body .container-xl {
  max-width: 1200px;
}

/* ---------- 侧栏微调（Tabler navbar-vertical 基础上） ---------- */
.navbar-vertical {
  flex-shrink: 0;
}
.admin-actions {
  margin-top: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  border-top: 1px solid var(--border);
  padding-top: var(--space-3);
}
.admin-actions .btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

/* ---------- 移动端：顶栏 + 抽屉（保留原逻辑） ---------- */
.admin-topbar,
.admin-hamburger,
.admin-mask {
  display: none;
}
@media (max-width: 768px) {
  .layout-fluid {
    flex-direction: column;
  }
  .admin-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 52px;
    padding: 0 var(--space-4);
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 120;
  }
  .admin-brand-sm {
    font-weight: 700;
    color: var(--text);
  }
  .admin-hamburger {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    width: 36px;
    height: 36px;
    background: none;
    border: none;
    padding: var(--space-2);
    cursor: pointer;
  }
  .admin-hamburger .bar {
    display: block;
    height: 2px;
    width: 100%;
    border-radius: 2px;
    background: var(--text);
    transition: transform 0.25s ease, opacity var(--transition-base);
  }
  .admin-hamburger.open .bar:nth-child(1) { transform: translateY(6px) rotate(45deg); }
  .admin-hamburger.open .bar:nth-child(2) { opacity: 0; }
  .admin-hamburger.open .bar:nth-child(3) { transform: translateY(-6px) rotate(-45deg); }

  .navbar-vertical {
    position: fixed;
    left: 0;
    top: 52px;
    bottom: 0;
    height: auto;
    z-index: 110;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    box-shadow: var(--shadow-lg);
  }
  .navbar-vertical.open {
    transform: translateX(0);
  }
  .admin-mask {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 105;
  }
  .page-body {
    padding: var(--space-4);
  }
}
</style>
