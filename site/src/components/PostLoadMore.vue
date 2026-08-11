<script setup lang="ts">
// 全部文章页：无限滚动分段加载（每段 pageSize 篇）
// 底部哨兵进入视口自动加载下一页；手动按钮兜底
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

interface CatItem { id: number; name: string; slug: string }
interface ListPost {
  id: number; title: string; slug: string; summary: string;
  categoryId: number | null; createdAt: number;
  tags: { name: string; slug: string }[];
}

const props = defineProps<{
  pageSize: number;
  total: number;
  /** 服务端已渲染首页，客户端从该页开始拉取 */
  startPage: number;
  /** 服务端已渲染的文章数（用于已加载计数） */
  initialCount: number;
  cats?: CatItem[];
}>();

const items = ref<ListPost[]>([]);
const page = ref(props.startPage);
const loading = ref(false);
const error = ref('');
const loaded = ref(props.initialCount);
const done = computed(() => loaded.value >= props.total);
const sentinel = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

function catOf(id: number | null) {
  return props.cats?.find((c) => c.id === id);
}
function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

async function loadMore() {
  if (loading.value || done.value) return;
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch(`/api/posts?page=${page.value}&pageSize=${props.pageSize}`);
    if (!res.ok) throw new Error('load failed');
    const body = await res.json();
    const list: ListPost[] = body.data?.list ?? [];
    items.value.push(...list);
    loaded.value += list.length;
    page.value += 1;
  } catch {
    error.value = '加载失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  // 无限滚动：哨兵可见且未到底时自动加载下一页
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) loadMore();
    },
    { rootMargin: '160px 0px' },
  );
  if (sentinel.value) observer.observe(sentinel.value);
});
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div class="posts-more">
    <ul v-if="items.length" class="posts-list">
      <li v-for="p in items" :key="p.id" class="posts-item">
        <div class="posts-meta">
          <a v-if="p.categoryId && catOf(p.categoryId)" class="posts-cat" :href="`/category/${catOf(p.categoryId)!.slug}`">
            {{ catOf(p.categoryId)!.name }}
          </a>
          <time class="posts-date">{{ fmtDate(p.createdAt) }}</time>
        </div>
        <h2 class="posts-title"><a :href="`/post/${p.slug}`">{{ p.title }}</a></h2>
        <p v-if="p.summary" class="posts-summary">{{ p.summary }}</p>
        <div v-if="p.tags.length" class="posts-tags">
          <a v-for="t in p.tags" :key="t.slug" class="posts-tag" :href="`/tag/${t.slug}`">#{{ t.name }}</a>
        </div>
      </li>
    </ul>

    <div ref="sentinel" class="posts-more-bar">
      <p v-if="error" class="posts-more-error">{{ error }}</p>
      <template v-if="!done">
        <p v-if="loading" class="posts-more-done">加载中…</p>
        <button v-else type="button" class="posts-more-btn" @click="loadMore">
          加载更多（已加载 {{ loaded }} / {{ total }}）
        </button>
      </template>
      <p v-else class="posts-more-done">已全部加载 · 共 {{ total }} 篇</p>
    </div>
  </div>
</template>
