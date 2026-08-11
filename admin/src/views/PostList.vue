<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api, type Post, type Category } from '../api/admin';
import { toast } from '../lib/toast';

const router = useRouter();

const posts = ref<Post[]>([]);
const categories = ref<Category[]>([]);
const selectedCategory = ref<number | 'all'>('all');
const selectedStatus = ref<string>('all');
const searchQuery = ref('');
const currentPage = ref(1);
const pageSize = 5;

async function loadData() {
  categories.value = await api.getCategories();
  posts.value = await api.getPosts();
}

const filteredPosts = computed(() => {
  return posts.value.filter((p) => {
    if (selectedCategory.value !== 'all' && p.categoryId !== selectedCategory.value) {
      return false;
    }
    if (selectedStatus.value !== 'all' && p.status !== selectedStatus.value) {
      return false;
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase();
      const matchTitle = p.title.toLowerCase().includes(q);
      const matchSummary = p.summary.toLowerCase().includes(q);
      if (!matchTitle && !matchSummary) return false;
    }
    return true;
  });
});

const totalPages = computed(() => Math.ceil(filteredPosts.value.length / pageSize) || 1);

const paginatedPosts = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredPosts.value.slice(start, start + pageSize);
});

async function handleDelete(id: number, title: string) {
  if (confirm(`确定要删除文章《${title}》吗？此操作无法撤销。`)) {
    const success = await api.deletePost(id);
    if (success) {
      toast.success('文章已删除');
      loadData();
    }
  }
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="post-list-view">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h2 class="page-title">文章管理</h2>
        <div class="text-muted">共 {{ filteredPosts.length }} 篇博文，支持根据分类、状态与关键词检索</div>
      </div>
      <router-link to="/posts/new" class="btn btn-primary d-flex align-items-center gap-1 shadow-sm">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span>新建文章</span>
      </router-link>
    </div>

    <!-- Filter Toolbar Card -->
    <div class="card mb-4">
      <div class="card-body p-3">
        <div class="row g-2 align-items-center">
          <!-- Search Input -->
          <div class="col-md-5">
            <div class="input-icon">
              <input
                type="text"
                v-model="searchQuery"
                class="form-control"
                placeholder="搜索文章标题或摘要..."
              />
            </div>
          </div>

          <!-- Category Filter Dropdown -->
          <div class="col-md-3 col-6">
            <select v-model="selectedCategory" class="form-select">
              <option value="all">全部分类</option>
              <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                {{ cat.name }}
              </option>
            </select>
          </div>

          <!-- Status Filter Dropdown -->
          <div class="col-md-3 col-6">
            <select v-model="selectedStatus" class="form-select">
              <option value="all">全部状态</option>
              <option value="published">已发布</option>
              <option value="draft">草稿</option>
              <option value="archived">归档</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Articles Table -->
    <div class="card">
      <div class="table-responsive">
        <table class="table table-vcenter card-table table-hover">
          <thead>
            <tr>
              <th style="width: 40%">标题 / 封面</th>
              <th>分类</th>
              <th>标签</th>
              <th>状态</th>
              <th class="text-center">阅读 / 评论</th>
              <th>发布时间</th>
              <th class="text-end">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="paginatedPosts.length === 0">
              <td colspan="7" class="text-center text-muted py-5">
                暂无符合条件的文章
              </td>
            </tr>

            <tr v-for="post in paginatedPosts" :key="post.id">
              <td>
                <div class="d-flex align-items-center gap-3">
                  <div
                    v-if="post.cover"
                    class="rounded border bg-body-tertiary flex-shrink-0"
                    style="width: 52px; height: 38px; background-size: cover; background-position: center;"
                    :style="{ backgroundImage: `url(${post.cover})` }"
                  ></div>
                  <div
                    v-else
                    class="rounded border bg-body-tertiary flex-shrink-0 d-flex align-items-center justify-content-center text-muted small"
                    style="width: 52px; height: 38px;"
                  >
                    无图
                  </div>
                  <div class="min-w-0">
                    <router-link :to="'/posts/' + post.id" class="fw-bold text-main text-decoration-none text-truncate d-block">
                      {{ post.title }}
                    </router-link>
                    <div class="text-muted micro-text text-truncate" style="max-width: 320px;">
                      {{ post.summary || '暂无摘要' }}
                    </div>
                  </div>
                </div>
              </td>

              <td>
                <span class="badge badge-soft-primary fw-medium">{{ post.categoryName }}</span>
              </td>

              <td>
                <div class="d-flex flex-wrap gap-1">
                  <span v-for="tag in post.tags" :key="tag" class="tag-chip py-0 px-2 micro-text">
                    {{ tag }}
                  </span>
                </div>
              </td>

              <td>
                <span v-if="post.status === 'published'" class="badge badge-soft-success">已发布</span>
                <span v-else-if="post.status === 'draft'" class="badge badge-soft-secondary">草稿</span>
                <span v-else class="badge badge-soft-warning">归档</span>
              </td>

              <td class="text-center small">
                <div class="fw-medium">{{ post.views }} 次阅读</div>
                <div class="text-muted micro-text">{{ post.commentCount }} 条评论</div>
              </td>

              <td class="small text-muted">
                {{ post.created_at.substring(0, 10) }}
              </td>

              <td class="text-end">
                <div class="btn-list flex-nowrap justify-content-end">
                  <router-link :to="'/posts/' + post.id" class="btn btn-sm btn-ghost-primary" title="编辑">
                    编辑
                  </router-link>
                  <button @click="handleDelete(post.id, post.title)" class="btn btn-sm btn-ghost-danger" title="删除">
                    删除
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer -->
      <div class="card-footer d-flex align-items-center justify-content-between py-3">
        <div class="text-muted small">
          显示第 {{ Math.min((currentPage - 1) * pageSize + 1, filteredPosts.length) }} -
          {{ Math.min(currentPage * pageSize, filteredPosts.length) }} 条，共 {{ filteredPosts.length }} 条
        </div>

        <ul class="pagination m-0">
          <li class="page-item" :class="{ disabled: currentPage === 1 }">
            <button class="page-item-btn" @click="currentPage--" :disabled="currentPage === 1">上一页</button>
          </li>
          <li v-for="page in totalPages" :key="page" class="page-item" :class="{ active: currentPage === page }">
            <button class="page-item-btn" @click="currentPage = page">{{ page }}</button>
          </li>
          <li class="page-item" :class="{ disabled: currentPage === totalPages }">
            <button class="page-item-btn" @click="currentPage++" :disabled="currentPage === totalPages">下一页</button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.micro-text {
  font-size: 0.75rem;
}
.page-item-btn {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  border-radius: 0.375rem;
  background: transparent;
  border: 1px solid var(--mb-border-color);
  color: var(--mb-text-main);
  cursor: pointer;
  margin: 0 2px;
}
.page-item.active .page-item-btn {
  background-color: var(--mb-primary);
  border-color: var(--mb-primary);
  color: #ffffff;
}
.page-item.disabled .page-item-btn {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
