<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { adminGetComments, adminPatchComment, adminDeleteComment, type CommentRow } from '../api/admin';

const list = ref<CommentRow[]>([]);
const filter = ref('');

async function load() {
  list.value = await adminGetComments({ status: filter.value || undefined });
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
    <table class="table">
      <thead><tr><th>内容</th><th>作者</th><th>状态</th><th>时间</th><th>操作</th></tr></thead>
      <tbody>
        <tr v-for="c in list" :key="c.id">
          <td class="content-cell">{{ c.content }}</td>
          <td>{{ c.author }}</td>
          <td><span class="badge" :class="c.status">{{ { pending: '待审核', approved: '已通过', rejected: '已拒绝' }[c.status] }}</span></td>
          <td>{{ new Date(c.createdAt).toLocaleString('zh-CN') }}</td>
          <td>
            <button v-if="c.status !== 'approved'" class="link-btn" @click="setStatus(c, 'approved')">通过</button>
            <button v-if="c.status !== 'rejected'" class="link-btn warn" @click="setStatus(c, 'rejected')">拒绝</button>
            <button class="link-btn danger" @click="remove(c.id)">删除</button>
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
.table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 10px; }
.table th, .table td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #f0f0f0; font-size: 14px; vertical-align: top; }
.table th { background: #f9fafb; color: #6b7280; }
.content-cell { max-width: 360px; white-space: pre-wrap; }
.badge { padding: 2px 10px; border-radius: 999px; font-size: 12px; }
.badge.pending { background: #fef3c7; color: #b45309; }
.badge.approved { background: #ecfdf5; color: #059669; }
.badge.rejected { background: #fee2e2; color: #dc2626; }
.link-btn { background: none; border: none; color: #3b82f6; cursor: pointer; margin-right: 8px; }
.link-btn.warn { color: #d97706; }
.link-btn.danger { color: #dc2626; }
.empty { color: #6b7280; text-align: center; padding: 32px 0; }
</style>
