<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  adminGetComments, adminPatchComment, adminDeleteComment,
  adminReplyComment, adminBatchComments, type CommentRow,
} from '../api/admin';

const list = ref<CommentRow[]>([]);
const filter = ref('');
const selected = ref<number[]>([]);
const replyingId = ref<number | null>(null);
const replyContent = ref('');
const error = ref('');

async function load() {
  try {
    list.value = await adminGetComments({ status: filter.value || undefined });
    // 过滤掉已被删除/移出列表的选中项
    const ids = new Set(list.value.map((c) => c.id));
    selected.value = selected.value.filter((id) => ids.has(id));
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败';
  }
}
async function setStatus(c: CommentRow, status: CommentRow['status']) {
  await adminPatchComment(c.id, status);
  load();
}
async function remove(id: number) {
  if (!confirm('确定删除该评论？')) return;
  await adminDeleteComment(id);
  load();
}
function toggleSelect(id: number) {
  const i = selected.value.indexOf(id);
  if (i >= 0) selected.value.splice(i, 1);
  else selected.value.push(id);
}
const allSelected = computed(() => list.value.length > 0 && selected.value.length === list.value.length);
function toggleAll() {
  selected.value = allSelected.value ? [] : list.value.map((c) => c.id);
}
function startReply(c: CommentRow) {
  replyingId.value = c.id;
  replyContent.value = '';
}
function cancelReply() {
  replyingId.value = null;
  replyContent.value = '';
}
async function submitReply(c: CommentRow) {
  const content = replyContent.value.trim();
  if (!content) return;
  await adminReplyComment(c.id, content);
  cancelReply();
  load();
}
async function batch(action: 'approve' | 'reject' | 'delete') {
  if (!selected.value.length) return;
  if (action === 'delete' && !confirm(`确定删除选中的 ${selected.value.length} 条评论？`)) return;
  await adminBatchComments(selected.value, action);
  selected.value = [];
  load();
}
onMounted(load);
</script>

<template>
  <div>
    <div class="head">
      <h1 class="page-title">评论管理</h1>
      <select v-model="filter" class="filter" @change="load">
        <option value="">全部</option>
        <option value="pending">待审核</option>
        <option value="approved">已通过</option>
        <option value="rejected">已拒绝</option>
      </select>
    </div>
    <div class="toolbar">
      <label class="select-all">
        <input type="checkbox" :checked="allSelected" @change="toggleAll" /> 全选
      </label>
      <button class="btn" :disabled="!selected.length" @click="batch('approve')">通过</button>
      <button class="btn warn" :disabled="!selected.length" @click="batch('reject')">拒绝</button>
      <button class="btn danger" :disabled="!selected.length" @click="batch('delete')">删除</button>
      <span v-if="selected.length" class="batch-info">已选 {{ selected.length }} 项</span>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <table class="table">
      <thead>
        <tr>
          <th class="checkbox-cell"><input type="checkbox" :checked="allSelected" @change="toggleAll" /></th>
          <th>内容</th><th>作者</th><th>状态</th><th>时间</th><th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in list" :key="c.id">
          <td class="checkbox-cell"><input type="checkbox" :checked="selected.includes(c.id)" @change="toggleSelect(c.id)" /></td>
          <td class="content-cell">{{ c.content }}</td>
          <td>{{ c.author }}</td>
          <td><span class="badge" :class="c.status">{{ { pending: '待审核', approved: '已通过', rejected: '已拒绝' }[c.status] }}</span></td>
          <td>{{ new Date(c.createdAt).toLocaleString('zh-CN') }}</td>
          <td>
            <div v-if="replyingId === c.id" class="reply-box">
              <textarea v-model="replyContent" class="reply-textarea" rows="3" placeholder="输入回复内容..."></textarea>
              <div class="reply-actions">
                <button class="btn" :disabled="!replyContent.trim()" @click="submitReply(c)">提交</button>
                <button class="link-btn" @click="cancelReply">取消</button>
              </div>
            </div>
            <template v-else>
              <button v-if="c.status !== 'approved'" class="link-btn" @click="setStatus(c, 'approved')">通过</button>
              <button v-if="c.status !== 'rejected'" class="link-btn warn" @click="setStatus(c, 'rejected')">拒绝</button>
              <button class="link-btn" @click="startReply(c)">回复</button>
              <button class="link-btn danger" @click="remove(c.id)">删除</button>
            </template>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="!list.length" class="empty">暂无评论</p>
  </div>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-title { font-size: 22px; margin: 0; }
.filter { padding: 6px 10px; border: 1px solid #e5e7eb; border-radius: 8px; }
.toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.select-all { display: flex; align-items: center; gap: 6px; font-size: 14px; color: #374151; margin-right: 8px; }
.batch-info { color: #6b7280; font-size: 13px; margin-left: 8px; }
.btn { padding: 6px 14px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; color: #374151; font-size: 14px; cursor: pointer; }
.btn:hover:not(:disabled) { border-color: #d1d5db; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn.warn { color: #d97706; }
.btn.danger { color: #dc2626; }
.table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 10px; }
.table th, .table td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #f0f0f0; font-size: 14px; vertical-align: top; }
.table th { background: #f9fafb; color: #6b7280; }
.checkbox-cell { width: 40px; }
.content-cell { max-width: 360px; white-space: pre-wrap; }
.badge { padding: 2px 10px; border-radius: 999px; font-size: 12px; }
.badge.pending { background: #fef3c7; color: #b45309; }
.badge.approved { background: #ecfdf5; color: #059669; }
.badge.rejected { background: #fee2e2; color: #dc2626; }
.link-btn { background: none; border: none; color: #3b82f6; cursor: pointer; margin-right: 8px; }
.link-btn.warn { color: #d97706; }
.link-btn.danger { color: #dc2626; }
.reply-box { display: flex; flex-direction: column; gap: 8px; }
.reply-textarea { width: 260px; padding: 8px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px; resize: vertical; }
.reply-actions { display: flex; align-items: center; gap: 8px; }
.error { color: #dc2626; font-size: 14px; margin: 0 0 8px; }
.empty { color: #6b7280; text-align: center; padding: 32px 0; }
</style>
