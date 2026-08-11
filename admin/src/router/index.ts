import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: () => import('../views/Login.vue') },
    {
      path: '/',
      component: () => import('../views/AdminLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'dashboard', component: () => import('../views/Dashboard.vue') },
        { path: 'posts', name: 'admin-posts', component: () => import('../views/PostList.vue') },
        { path: 'posts/new', name: 'admin-post-new', component: () => import('../views/PostEditor.vue') },
        { path: 'posts/:id', name: 'admin-post-edit', component: () => import('../views/PostEditor.vue') },
        { path: 'categories', name: 'admin-categories', component: () => import('../views/CategoryManager.vue') },
        { path: 'tags', name: 'admin-tags', component: () => import('../views/TagManager.vue') },
        { path: 'comments', name: 'admin-comments', component: () => import('../views/CommentManager.vue') },
        { path: 'friends', name: 'admin-friends', component: () => import('../views/FriendLinkManager.vue') },
        { path: 'settings', name: 'admin-settings', component: () => import('../views/SettingsPage.vue') },
        { path: 'themes', name: 'admin-themes', component: () => import('../views/ThemesPage.vue') },
      ],
    },
  ],
});

router.beforeEach((to) => {
  const token = localStorage.getItem('admin_token');
  // 未登录访问受保护页面 → 登录页
  if (to.meta.requiresAuth && !token) return { name: 'login' };
  // 登录页：token 存在但可能已过期（过期 token 由 client.ts 在首次 401 时清除并跳转登录），
  // 因此不再强制把带 token 的访问从 /login 弹回后台——否则过期 token 用户会陷入 登录页→后台→401→登录页 的死循环。
});
