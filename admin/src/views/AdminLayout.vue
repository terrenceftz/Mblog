<script setup lang="ts">
import { useRouter } from 'vue-router';
import { logout } from '../api/admin';

const router = useRouter();
function doLogout() {
  logout();
  router.push('/admin/login');
}
</script>

<template>
  <div class="admin-layout">
    <aside class="admin-side">
      <div class="admin-brand">MBLOG 后台</div>
      <nav>
        <router-link to="/admin/">仪表盘</router-link>
        <router-link to="/admin/posts">文章</router-link>
        <router-link to="/admin/categories">分类</router-link>
        <router-link to="/admin/tags">标签</router-link>
        <router-link to="/admin/comments">评论</router-link>
        <router-link to="/admin/friends">友链</router-link>
        <router-link to="/admin/settings">设置</router-link>
      </nav>
      <div class="admin-actions">
        <a href="/">← 查看站点</a>
        <button type="button" @click="doLogout">退出登录</button>
      </div>
    </aside>
    <main class="admin-main"><slot /></main>
  </div>
</template>

<style scoped>
.admin-layout { display: flex; min-height: 100vh; background: #f5f6f8; }
.admin-side { width: 200px; background: #1f2937; color: #e5e7eb; display: flex; flex-direction: column; padding: 16px 0; position: sticky; top: 0; height: 100vh; }
.admin-brand { padding: 0 20px 16px; font-weight: 700; font-size: 16px; border-bottom: 1px solid #374151; }
.admin-side nav { display: flex; flex-direction: column; padding: 12px 0; }
.admin-side nav a { color: #d1d5db; text-decoration: none; padding: 10px 20px; font-size: 14px; }
.admin-side nav a.router-link-active, .admin-side nav a:hover { background: #374151; color: #fff; }
.admin-actions { margin-top: auto; padding: 12px 20px; display: flex; flex-direction: column; gap: 10px; border-top: 1px solid #374151; }
.admin-actions a { color: #d1d5db; font-size: 13px; text-decoration: none; }
.admin-actions button { background: none; border: 1px solid #4b5563; color: #e5e7eb; border-radius: 6px; padding: 6px; cursor: pointer; font-size: 13px; }
.admin-main { flex: 1; padding: 24px; max-width: 1100px; }
</style>
