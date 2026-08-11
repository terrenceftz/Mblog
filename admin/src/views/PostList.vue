<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { adminGetPosts, adminDeletePost, type AdminPostRow } from '../api/admin';
import { toast } from '../lib/toast';

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
    toast('文章已删除', 'success');
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
    <div class="page-header d-flex align-items-center justify-content-between flex-wrap gap-2">
      <h1 class="page-title">文章管理</h1>
      <div class="d-flex align-items-center gap-2">
        <select v-model="statusFilter" class="form-select form-select-sm" @change="changeFilter">
          <option value="">全部状态</option>
          <option value="published">已发布</option>
          <option value="draft">草稿</option>
        </select>
        <button class="btn btn-primary btn-sm" @click="router.push('/posts/new')">＋ 新建文章</button>
      </div>
    </div>
    <div v-if="error" class="alert alert-danger py-2" role="alert">{{ error }}</div>
    <div class="table-responsive">
      <table class="table table-vcenter">
        <thead>
          <tr><th>标题</th><th>状态</th><th>更新时间</th><th>阅读量</th><th>操作</th></tr>
        </thead>
        <tbody>
          <tr v-for="p in posts" :key="p.id">
            <td><router-link :to="`/posts/${p.id}`" class="title-link">{{ p.title }}</router-link></td>
            <td>
              <span class="badge" :class="p.status === 'published' ? 'bg-success-soft' : 'bg-secondary-soft'">
                {{ p.status === 'published' ? '已发布' : '草稿' }}
              </span>
            </td>
            <td>{{ new Date(p.updatedAt).toLocaleDateString('zh-CN') }}</td>
            <td class="text-secondary">{{ p.viewCount }}</td>
            <td class="op-cell">
              <button class="btn btn-outline-primary btn-sm" @click="router.push(`/posts/${p.id}`)">编辑</button>
              <button class="btn btn-outline-danger btn-sm" @click="remove(p.id)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="!posts.length && !error" class="text-secondary text-center py-4">暂无文章</p>
    <nav v-if="total > pageSize" class="pagination pagination-sm justify-content-end mt-3">
      <li class="page-item" :class="{ disabled: page <= 1 }">
        <a class="page-link" href="#" @click.prevent="page -= 1; load()">上一页</a>
      </li>
      <li class="page-item disabled"><span class="page-link">{{ page }} / {{ totalPages }}</span></li>
      <li class="page-item" :class="{ disabled: page >= totalPages }">
        <a class="page-link" href="#" @click.prevent="page += 1; load()">下一页</a>
      </li>
    </nav>
  </div>
</template>

<style scoped>
.title-link { color: var(--primary); text-decoration: none; }
.title-link:hover { text-decoration: underline; }
.op-cell { white-space: nowrap; }
.op-cell .btn { margin-right: var(--space-2); }
.op-cell .btn:last-child { margin-right: 0; }
</style>
