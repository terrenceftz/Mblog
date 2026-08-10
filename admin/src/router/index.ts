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
      ],
    },
  ],
});

router.beforeEach((to) => {
  const token = localStorage.getItem('admin_token');
  if (to.meta.requiresAuth && !token) return { name: 'login' };
  if (to.name === 'login' && token) return { name: 'dashboard' };
});
