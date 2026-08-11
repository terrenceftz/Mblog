<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  adminGetFriendLinks, adminPutFriendLink, adminDeleteFriendLink, type FriendLinkRow,
} from '../api/admin';
import { toast } from '../lib/toast';

const list = ref<FriendLinkRow[]>([]);
const filter = ref('');
const error = ref('');

const statusText: Record<FriendLinkRow['status'], string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
};
function statusBadgeClass(s: FriendLinkRow['status']) {
  return s === 'approved' ? 'bg-success-soft' : s === 'pending' ? 'bg-warning-soft' : 'bg-danger-soft';
}
async function load() {
  try {
    list.value = await adminGetFriendLinks({ status: filter.value || undefined });
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败';
  }
}
async function setStatus(l: FriendLinkRow, status: FriendLinkRow['status']) {
  await adminPutFriendLink(l.id, { status });
  toast(status === 'approved' ? '友链已通过' : '友链已拒绝', 'success');
  load();
}
async function remove(id: number) {
  if (!confirm('确定删除该友链？')) return;
  await adminDeleteFriendLink(id);
  toast('友链已删除', 'success');
  load();
}
onMounted(load);
</script>

<template>
  <div>
    <div class="page-header">
      <div class="page-header-titles">
        <h1 class="page-title">友链管理</h1>
      </div>
      <div class="page-header-actions">
        <select v-model="filter" class="form-control" @change="load">
          <option value="">全部</option>
          <option value="pending">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已拒绝</option>
        </select>
      </div>
    </div>
    <p v-if="error" class="alert alert-danger py-2">{{ error }}</p>
    <div class="table-responsive">
      <table class="table table-vcenter">
        <thead><tr><th>站名</th><th>网址</th><th>简介</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="l in list" :key="l.id">
            <td>{{ l.name }}</td>
            <td><a :href="l.url" target="_blank" rel="noopener" class="url">{{ l.url }}</a></td>
            <td class="desc-cell">{{ l.description }}</td>
            <td><span class="badge" :class="statusBadgeClass(l.status)">{{ statusText[l.status] }}</span></td>
            <td class="op-cell">
              <button v-if="l.status !== 'approved'" class="btn btn-success btn-sm" @click="setStatus(l, 'approved')">通过</button>
              <button v-if="l.status !== 'rejected'" class="btn btn-outline-danger btn-sm" @click="setStatus(l, 'rejected')">拒绝</button>
              <button class="btn btn-outline-danger btn-sm" @click="remove(l.id)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="!list.length" class="text-secondary text-center py-4">暂无友链</p>
  </div>
</template>

<style scoped>
.url { color: var(--primary); text-decoration: none; }
.url:hover { text-decoration: underline; }
.desc-cell { max-width: 240px; color: var(--text-muted); }
.op-cell { white-space: nowrap; }
.op-cell .btn { margin-right: var(--space-2); }
.op-cell .btn:last-child { margin-right: 0; }
</style>
