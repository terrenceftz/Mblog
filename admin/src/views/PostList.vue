<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { adminGetPosts, adminDeletePost, type AdminPostRow } from '../api/admin';

const router = useRouter();
const posts = ref<AdminPostRow[]>([]);
const statusFilter = ref('');
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const error = ref('');

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));

async function load() {
  error.value = '';
  try {
    const data = await adminGetPosts({
      page: page.value,
      pageSize: pageSize.value,
      status: statusFilter.value || undefined,
    });
    posts.value = data.list;
    total.value = data.total;
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败';
  }
}
function changeFilter() {
  page.value = 1;
  load();
}
async function remove(id: number) {
  if (!confirm('确定删除该文章？此操作不可恢复。')) return;
  try {
    await adminDeletePost(id);
    // 删除后若当前页已空且不是第一页，回退一页
    if (posts.value.length === 1 && page.value > 1) page.value -= 1;
    load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '删除失败';
  }
}
onMounted(() => load().catch((e) => { error.value = e instanceof Error ? e.message : '加载失败'; }));
</script>

<template>
  <div>
    <div class="toolbar">
      <h1 class="page-title">文章管理</h1>
      <button class="btn primary" @click="router.push('/posts/new')">＋ 新建文章</button>
    </div>
    <select v-model="statusFilter" class="filter" @change="changeFilter">
      <option value="">全部状态</option>
      <option value="published">已发布</option>
      <option value="draft">草稿</option>
    </select>
    <p v-if="error" class="error">{{ error }}</p>
    <table class="table">
      <thead>
        <tr><th>标题</th><th>状态</th><th>更新时间</th><th>阅读量</th><th>操作</th></tr>
      </thead>
      <tbody>
        <tr v-for="p in posts" :key="p.id">
          <td><router-link :to="`/posts/${p.id}`">{{ p.title }}</router-link></td>
          <td><span class="badge" :class="p.status">{{ p.status === 'published' ? '已发布' : '草稿' }}</span></td>
          <td>{{ new Date(p.updatedAt).toLocaleDateString('zh-CN') }}</td>
          <td>{{ p.viewCount }}</td>
          <td>
            <button class="link-btn" @click="router.push(`/posts/${p.id}`)">编辑</button>
            <button class="link-btn danger" @click="remove(p.id)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="!posts.length && !error" class="empty">暂无文章</p>
    <div v-if="total > pageSize" class="pagination">
      <button class="page-btn" :disabled="page <= 1" @click="page -= 1; load()">上一页</button>
      <span class="page-indicator">{{ page }} / {{ totalPages }}</span>
      <button class="page-btn" :disabled="page >= totalPages" @click="page += 1; load()">下一页</button>
    </div>
  </div>
</template>

<style scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-title { font-size: 22px; margin: 0; }
.btn { border: none; border-radius: 8px; padding: 8px 16px; cursor: pointer; }
.btn.primary { background: #3b82f6; color: #fff; }
.filter { margin-bottom: 16px; padding: 6px 10px; border: 1px solid #e5e7eb; border-radius: 8px; }
.table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 10px; overflow: hidden; }
.table th, .table td { padding: 12px 14px; text-align: left; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
.table th { background: #f9fafb; color: #6b7280; font-weight: 600; }
.badge { padding: 2px 10px; border-radius: 999px; font-size: 12px; }
.badge.published { background: #ecfdf5; color: #059669; }
.badge.draft { background: #fef3c7; color: #b45309; }
.link-btn { background: none; border: none; color: #3b82f6; cursor: pointer; font-size: 14px; margin-right: 8px; }
.link-btn.danger { color: #dc2626; }
.empty { color: #6b7280; text-align: center; padding: 32px 0; }
.error { color: #dc2626; font-size: 14px; margin: 0 0 8px; }
.pagination { display: flex; align-items: center; gap: 12px; margin-top: 16px; }
.page-btn { border: 1px solid #d1d5db; background: #fff; border-radius: 8px; padding: 6px 14px; cursor: pointer; font-size: 14px; }
.page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.page-indicator { font-size: 14px; color: #6b7280; }
</style>
