<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  adminGetComments, adminPatchComment, adminDeleteComment,
  adminReplyComment, adminBatchComments, type CommentRow,
} from '../api/admin';
import { toast } from '../lib/toast';

const route = useRoute();
const router = useRouter();
const list = ref<CommentRow[]>([]);
const filter = ref(typeof route.query.status === 'string' ? route.query.status : '');
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
function changeFilter() {
  load();
  router.replace({ query: filter.value ? { status: filter.value } : {} });
}
async function setStatus(c: CommentRow, status: CommentRow['status']) {
  await adminPatchComment(c.id, status);
  toast(status === 'approved' ? '评论已通过' : '评论已拒绝', 'success');
  load();
}
async function remove(id: number) {
  if (!confirm('确定删除该评论？')) return;
  await adminDeleteComment(id);
  toast('评论已删除', 'success');
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
  toast('回复成功', 'success');
  cancelReply();
  load();
}
async function batch(action: 'approve' | 'reject' | 'delete') {
  if (!selected.value.length) return;
  if (action === 'delete' && !confirm(`确定删除选中的 ${selected.value.length} 条评论？`)) return;
  const count = selected.value.length;
  await adminBatchComments(selected.value, action);
  const label = action === 'approve' ? '通过' : action === 'reject' ? '拒绝' : '删除';
  toast(`已${label} ${count} 条评论`, 'success');
  selected.value = [];
  load();
}
onMounted(load);
</script>

<template>
  <div>
    <div class="toolbar">
      <h1 class="page-title">评论管理</h1>
      <select v-model="filter" class="input" @change="changeFilter">
        <option value="">全部</option>
        <option value="pending">待审核</option>
        <option value="approved">已通过</option>
        <option value="rejected">已拒绝</option>
      </select>
    </div>
    <div class="toolbar batch-toolbar">
      <label class="select-all">
        <input type="checkbox" :checked="allSelected" @change="toggleAll" /> 全选
      </label>
      <button class="btn ok" :disabled="!selected.length" @click="batch('approve')">通过</button>
      <button class="btn bad" :disabled="!selected.length" @click="batch('reject')">拒绝</button>
      <button class="btn bad" :disabled="!selected.length" @click="batch('delete')">删除</button>
      <span v-if="selected.length" class="batch-info">已选 {{ selected.length }} 项</span>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <div class="table-wrap">
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
                <textarea v-model="replyContent" class="input reply-textarea" rows="3" placeholder="输入回复内容..."></textarea>
                <div class="reply-actions">
                  <button class="btn sm" :disabled="!replyContent.trim()" @click="submitReply(c)">提交</button>
                  <button class="link-btn" @click="cancelReply">取消</button>
                </div>
              </div>
              <div v-else class="op-cell">
                <button v-if="c.status !== 'approved'" class="btn sm ok" @click="setStatus(c, 'approved')">通过</button>
                <button v-if="c.status !== 'rejected'" class="btn sm bad" @click="setStatus(c, 'rejected')">拒绝</button>
                <button class="btn sm" @click="startReply(c)">回复</button>
                <button class="btn sm bad" @click="remove(c.id)">删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="!list.length" class="empty">暂无评论</p>
  </div>
</template>

<style scoped>
.toolbar { justify-content: space-between; }
.toolbar .page-title { margin: 0; }
.batch-toolbar { justify-content: flex-start; }
.select-all { display: flex; align-items: center; gap: 6px; font-size: 14px; color: var(--text-muted); margin-right: 8px; }
.batch-info { color: var(--text-muted); font-size: 13px; margin-left: 8px; }
input[type='checkbox'] { accent-color: var(--primary); }
.checkbox-cell { width: 40px; }
.content-cell { max-width: 360px; white-space: pre-wrap; }
.op-cell { white-space: nowrap; }
.op-cell .btn { margin-right: 8px; }
.op-cell .btn:last-child { margin-right: 0; }
.link-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 14px; }
.link-btn:hover { color: var(--primary); }
.reply-box { display: flex; flex-direction: column; gap: 8px; }
.reply-textarea { width: 260px; resize: vertical; font-family: inherit; }
.reply-actions { display: flex; align-items: center; gap: 8px; }
</style>
