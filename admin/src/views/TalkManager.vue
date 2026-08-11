<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { adminGetTalks, adminPatchTalk, type TalkRow } from '../api/admin';

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
    <h1 class="page-title">说说管理</h1>
    <div class="toolbar">
      <select v-model="filter" @change="load">
        <option value="">全部</option>
        <option value="pending">待审核</option>
        <option value="approved">已通过</option>
        <option value="rejected">已拒绝</option>
      </select>
    </div>
    <p v-if="error" class="error">{{ error }}</p>

    <ul v-if="list.length" class="talk-list">
      <li v-for="t in list" :key="t.id" class="talk-row">
        <div class="talk-main">
          <p class="talk-content">{{ t.content }}</p>
          <div class="talk-meta">
            <span class="talk-time">{{ fmtDate(t.createdAt) }}</span>
            <span class="talk-ip">{{ t.ip }}</span>
            <span class="talk-status" :class="t.status">{{ t.status }}</span>
          </div>
        </div>
        <div class="talk-actions">
          <button v-if="t.status !== 'approved'" class="btn ok" @click="setStatus(t, 'approved')">通过</button>
          <button v-if="t.status !== 'rejected'" class="btn bad" @click="setStatus(t, 'rejected')">拒绝</button>
        </div>
      </li>
    </ul>
    <p v-else class="empty">暂无说说</p>
  </div>
</template>

<style scoped>
.page-title { font-size: 22px; margin-bottom: 20px; }
.toolbar { margin-bottom: 16px; }
.toolbar select { padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 8px; }
.error { color: #dc2626; }
.talk-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.talk-row {
  display: flex; justify-content: space-between; align-items: center; gap: 12px;
  border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; background: #fff;
}
.talk-main { min-width: 0; }
.talk-content { margin: 0 0 6px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
.talk-meta { display: flex; gap: 12px; font-size: 12px; color: #9ca3af; }
.talk-status { padding: 1px 8px; border-radius: 999px; }
.talk-status.pending { background: #fef3c7; color: #b45309; }
.talk-status.approved { background: #d1fae5; color: #047857; }
.talk-status.rejected { background: #fee2e2; color: #b91c1c; }
.talk-actions { display: flex; gap: 8px; flex-shrink: 0; }
.btn { border: none; border-radius: 8px; padding: 6px 14px; cursor: pointer; font-size: 13px; }
.btn.ok { background: #059669; color: #fff; }
.btn.bad { background: #dc2626; color: #fff; }
.empty { color: #9ca3af; text-align: center; padding: 48px 0; }
</style>
