<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { adminGetTalks, adminPatchTalk, type TalkRow } from '../api/admin';
import { toast } from '../lib/toast';

const list = ref<TalkRow[]>([]);
const filter = ref('');
const error = ref('');

async function load() {
  try {
    list.value = await adminGetTalks({ status: filter.value || undefined });
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败';
  }
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
    <div class="toolbar">
      <h1 class="page-title">说说管理</h1>
      <select v-model="filter" class="input" @change="load">
        <option value="">全部</option>
        <option value="pending">待审核</option>
        <option value="approved">已通过</option>
        <option value="rejected">已拒绝</option>
      </select>
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
  </div>
</template>

<style scoped>
.toolbar { justify-content: space-between; }
.toolbar .page-title { margin: 0; }
.talk-list { display: flex; flex-direction: column; gap: 10px; }
.talk-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.talk-main { min-width: 0; }
.talk-content { margin: 0 0 6px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
.talk-meta { display: flex; align-items: center; gap: 12px; font-size: 12px; color: var(--text-muted); }
.talk-actions { display: flex; gap: 8px; flex-shrink: 0; }
</style>
