<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { adminGetTalks, adminPatchTalk, adminCreateTalk, type TalkRow } from '../api/admin';
import { toast } from '../lib/toast';

const list = ref<TalkRow[]>([]);
const filter = ref('');
const error = ref('');
const page = ref(1);
const pageSize = 10;
const total = ref(0);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

// 作者发布说说（免审核直发）
const compose = ref('');
const posting = ref(false);
async function publish() {
  const content = compose.value.trim();
  if (!content) {
    toast('写点什么再发布', 'error');
    return;
  }
  posting.value = true;
  try {
    await adminCreateTalk(content);
    toast('说说已发布', 'success');
    compose.value = '';
    page.value = 1;
    load();
  } catch (e) {
    toast(e instanceof Error ? e.message : '发布失败', 'error');
  } finally {
    posting.value = false;
  }
}

async function load() {
  try {
    const res = await adminGetTalks({ status: filter.value || undefined, page: page.value, pageSize });
    list.value = res.list;
    total.value = res.total;
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败';
  }
}
function changeFilter() {
  page.value = 1;
  load();
}
function goPage(p: number) {
  page.value = p;
  load();
}
async function setStatus(t: TalkRow, status: TalkRow['status']) {
  await adminPatchTalk(t.id, status);
  toast(status === 'approved' ? '说说已通过' : '说说已拒绝', 'success');
  load();
}
function fmtDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString('zh-CN');
}
onMounted(load);
</script>

<template>
  <div>
    <div class="page-header">
      <div class="page-header-titles">
        <h1 class="page-title">说说管理</h1>
      </div>
      <div class="page-header-actions">
        <select v-model="filter" class="input" @change="changeFilter">
          <option value="">全部</option>
          <option value="pending">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已拒绝</option>
        </select>
      </div>
    </div>

    <!-- 作者发布说说：免审核直发 -->
    <div class="card compose-card">
      <div class="card-title">写说说</div>
      <textarea
        v-model="compose"
        class="input compose-textarea"
        rows="3"
        maxlength="500"
        placeholder="此刻的想法…（发布者为作者，直接发布）"
      />
      <div class="compose-foot">
        <span class="compose-count" :class="{ near: compose.length >= 450, over: compose.length >= 500 }">
          {{ compose.length }}/500
        </span>
        <button class="btn primary compose-btn" :disabled="posting || !compose.trim()" @click="publish">
          <svg v-if="!posting" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
          {{ posting ? '发布中…' : '发布' }}
        </button>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="list.length" class="talk-list">
      <div v-for="t in list" :key="t.id" class="card talk-row">
        <div class="talk-main">
          <p class="talk-content">{{ t.content }}</p>
          <div class="talk-meta">
            <span class="talk-time">{{ fmtDate(t.createdAt) }}</span>
            <span class="talk-ip">{{ t.ip }}</span>
            <span class="badge" :class="t.status">{{ { pending: '待审核', approved: '已通过', rejected: '已拒绝' }[t.status] }}</span>
          </div>
        </div>
        <div class="talk-actions">
          <button v-if="t.status !== 'approved'" class="btn sm ok" @click="setStatus(t, 'approved')">通过</button>
          <button v-if="t.status !== 'rejected'" class="btn sm bad" @click="setStatus(t, 'rejected')">拒绝</button>
        </div>
      </div>
    </div>
    <p v-else class="empty">暂无说说</p>

    <nav v-if="total > pageSize" class="pagination">
      <button :disabled="page <= 1" @click="goPage(page - 1)">上一页</button>
      <span class="page-info">{{ page }} / {{ totalPages }}</span>
      <button :disabled="page >= totalPages" @click="goPage(page + 1)">下一页</button>
    </nav>
  </div>
</template>

<style scoped>
.compose-card { margin-bottom: var(--space-4); border-color: var(--border-strong); }
.compose-textarea {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  font-family: inherit;
  min-height: 76px;
  line-height: 1.7;
}
.compose-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-2);
}
.compose-count {
  font-size: var(--font-xs);
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
  transition: color var(--transition-base);
}
.compose-count.near { color: var(--warn); }
.compose-count.over { color: var(--danger); }
.compose-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.talk-list { display: flex; flex-direction: column; gap: var(--space-2); }
.talk-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  transition: border-color var(--transition-base);
}
.talk-row:hover { border-color: var(--border-strong); }
.talk-main { min-width: 0; }
.talk-content {
  margin: 0 0 6px;
  font-size: var(--font-base);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
.talk-meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--font-xs);
  color: var(--text-muted);
}
.talk-actions { display: flex; gap: var(--space-2); flex-shrink: 0; }
</style>
