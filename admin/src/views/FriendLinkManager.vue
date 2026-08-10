<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  adminGetFriendLinks, adminPutFriendLink, adminDeleteFriendLink, type FriendLinkRow,
} from '../api/admin';

const list = ref<FriendLinkRow[]>([]);
const filter = ref('');

async function load() {
  list.value = await adminGetFriendLinks({ status: filter.value || undefined });
}
async function setStatus(l: FriendLinkRow, status: FriendLinkRow['status']) {
  await adminPutFriendLink(l.id, { status });
  load();
}
async function remove(id: number) {
  if (!confirm('确定删除该友链？')) return;
  await adminDeleteFriendLink(id);
  load();
}
onMounted(load);
</script>

<template>
  <div>
    <div class="head">
      <h1 class="page-title">友链管理</h1>
      <select v-model="filter" class="filter" @change="load">
        <option value="">全部</option>
        <option value="pending">待审核</option>
        <option value="approved">已通过</option>
        <option value="rejected">已拒绝</option>
      </select>
    </div>
    <table class="table">
      <thead><tr><th>站名</th><th>网址</th><th>简介</th><th>状态</th><th>操作</th></tr></thead>
      <tbody>
        <tr v-for="l in list" :key="l.id">
          <td>{{ l.name }}</td>
          <td><a :href="l.url" target="_blank" rel="noopener" class="url">{{ l.url }}</a></td>
          <td class="desc-cell">{{ l.description }}</td>
          <td><span class="badge" :class="l.status">{{ { pending: '待审核', approved: '已通过', rejected: '已拒绝' }[l.status] }}</span></td>
          <td>
            <button v-if="l.status !== 'approved'" class="link-btn" @click="setStatus(l, 'approved')">通过</button>
            <button v-if="l.status !== 'rejected'" class="link-btn warn" @click="setStatus(l, 'rejected')">拒绝</button>
            <button class="link-btn danger" @click="remove(l.id)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="!list.length" class="empty">暂无友链</p>
  </div>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-title { font-size: 22px; margin: 0; }
.filter { padding: 6px 10px; border: 1px solid #e5e7eb; border-radius: 8px; }
.table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 10px; }
.table th, .table td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
.table th { background: #f9fafb; color: #6b7280; }
.url { color: #3b82f6; text-decoration: none; }
.desc-cell { max-width: 240px; color: #6b7280; }
.badge { padding: 2px 10px; border-radius: 999px; font-size: 12px; }
.badge.pending { background: #fef3c7; color: #b45309; }
.badge.approved { background: #ecfdf5; color: #059669; }
.badge.rejected { background: #fee2e2; color: #dc2626; }
.link-btn { background: none; border: none; color: #3b82f6; cursor: pointer; margin-right: 8px; }
.link-btn.warn { color: #d97706; }
.link-btn.danger { color: #dc2626; }
.empty { color: #6b7280; text-align: center; padding: 32px 0; }
</style>
