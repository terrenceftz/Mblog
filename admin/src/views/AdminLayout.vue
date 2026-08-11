<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { logout } from '../api/admin';
import ToastContainer from '../components/ToastContainer.vue';

const route = useRoute();
const router = useRouter();
const menuOpen = ref(false);

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
  <div class="admin-layout">
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

    <!-- 侧栏（移动端为抽屉） -->
    <aside class="admin-side" :class="{ open: menuOpen }">
      <div class="admin-brand">MBLOG 后台</div>
      <nav>
        <router-link
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :class="{ active: isActive(item.to) }"
          @click="menuOpen = false"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path :d="item.icon" />
          </svg>
          <span>{{ item.label }}</span>
        </router-link>
      </nav>
      <div class="admin-actions">
        <a href="http://localhost:4321/" target="_blank" rel="noopener noreferrer">← 查看站点</a>
        <button type="button" @click="doLogout">退出登录</button>
      </div>
    </aside>
    <div v-if="menuOpen" class="admin-mask" @click="menuOpen = false" />

    <main class="admin-main"><router-view /></main>
    <ToastContainer />
  </div>
</template>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: #0b0b0e;
}
.admin-side {
  width: 210px;
  background: #101014;
  color: #d1d5db;
  display: flex;
  flex-direction: column;
  padding: 16px 0;
  position: sticky;
  top: 0;
  height: 100vh;
  max-height: 100vh;
  overflow-y: auto;
  border-right: 1px solid #1f1f24;
  flex-shrink: 0;
}
.admin-side nav {
  display: flex;
  flex-direction: column;
  padding: 10px 0;
  flex: 1;
}
.admin-brand {
  padding: 0 20px 16px;
  font-weight: 700;
  font-size: 16px;
  color: #fafafa;
  border-bottom: 1px solid #1f1f24;
  flex-shrink: 0;
}
.admin-side nav a {
  color: #9d9d95;
  text-decoration: none;
  padding: 10px 20px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  border-left: 2px solid transparent;
  transition: color 0.18s ease, background-color 0.18s ease, border-color 0.18s ease;
}
.admin-side nav a.active,
.admin-side nav a:hover {
  color: #e8b64c;
  background: rgba(232, 182, 76, 0.08);
  border-left-color: #e8b64c;
}
.admin-actions {
  margin-top: auto;
  padding: 12px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-top: 1px solid #1f1f24;
}
.admin-actions a {
  color: #9d9d95;
  font-size: 13px;
  text-decoration: none;
}
.admin-actions a:hover {
  color: #e8b64c;
}
.admin-actions button {
  background: none;
  border: 1px solid #3f3f46;
  color: #e5e7eb;
  border-radius: 8px;
  padding: 7px;
  cursor: pointer;
  font-size: 13px;
}
.admin-actions button:hover {
  border-color: #f87171;
  color: #f87171;
}
.admin-main {
  flex: 1;
  padding: 24px;
  max-width: 1200px;
  min-width: 0;
}

/* 移动端 */
.admin-topbar,
.admin-hamburger,
.admin-mask {
  display: none;
}
@media (max-width: 768px) {
  .admin-layout {
    flex-direction: column;
  }
  .admin-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 52px;
    padding: 0 16px;
    background: #101014;
    border-bottom: 1px solid #1f1f24;
    position: sticky;
    top: 0;
    z-index: 120;
  }
  .admin-brand-sm {
    font-weight: 700;
    color: #fafafa;
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
    padding: 8px;
    cursor: pointer;
  }
  .admin-hamburger .bar {
    display: block;
    height: 2px;
    width: 100%;
    border-radius: 2px;
    background: #f4f4f5;
    transition: transform 0.25s ease, opacity 0.2s ease;
  }
  .admin-hamburger.open .bar:nth-child(1) { transform: translateY(6px) rotate(45deg); }
  .admin-hamburger.open .bar:nth-child(2) { opacity: 0; }
  .admin-hamburger.open .bar:nth-child(3) { transform: translateY(-6px) rotate(-45deg); }

  .admin-side {
    position: fixed;
    left: 0;
    top: 52px;
    bottom: 0;
    height: auto;
    z-index: 110;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    border-right: 1px solid #1f1f24;
  }
  .admin-side.open {
    transform: translateX(0);
  }
  .admin-mask {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 105;
  }
  .admin-main {
    padding: 16px;
  }
}
</style>
