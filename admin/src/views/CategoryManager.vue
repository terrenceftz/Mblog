<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  adminGetCategories, adminCreateCategory, adminUpdateCategory, adminDeleteCategory,
  type CategoryRow,
} from '../api/admin';

const list = ref<CategoryRow[]>([]);
const name = ref('');
const editing = ref<CategoryRow | null>(null);

async function load() {
  list.value = await adminGetCategories();
}
async function add() {
  if (!name.value.trim()) return;
  await adminCreateCategory({ name: name.value });
  name.value = '';
  load();
}
async function update() {
  if (!editing.value) return;
  await adminUpdateCategory(editing.value.id, { name: editing.value.name });
  editing.value = null;
  load();
}
async function remove(id: number) {
  if (!confirm('删除该分类？文章不会删除，仅解除关联。')) return;
  await adminDeleteCategory(id);
  load();
}
onMounted(load);
</script>

<template>
  <div>
    <h1 class="page-title">分类管理</h1>
    <div class="add-row">
      <input v-model="name" placeholder="新分类名称" @keyup.enter="add" />
      <button class="btn primary" @click="add">添加</button>
    </div>
    <table class="table">
      <thead><tr><th>名称</th><th>slug</th><th>文章数</th><th>操作</th></tr></thead>
      <tbody>
        <tr v-for="c in list" :key="c.id">
          <td>
            <template v-if="editing?.id === c.id">
              <input v-model="editing.name" @keyup.enter="update" />
            </template>
            <template v-else>{{ c.name }}</template>
          </td>
          <td>{{ c.slug }}</td>
          <td>{{ c.postCount }}</td>
          <td>
            <button class="link-btn" @click="editing = { ...c }">编辑</button>
            <button v-if="editing?.id === c.id" class="link-btn" @click="update">保存</button>
            <button class="link-btn danger" @click="remove(c.id)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.page-title { font-size: 22px; margin-bottom: 20px; }
.add-row { display: flex; gap: 10px; margin-bottom: 16px; }
.add-row input { flex: 1; max-width: 320px; padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 8px; }
.btn { border: none; border-radius: 8px; padding: 8px 16px; cursor: pointer; }
.btn.primary { background: #3b82f6; color: #fff; }
.table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 10px; }
.table th, .table td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
.table th { background: #f9fafb; color: #6b7280; }
.table input { padding: 4px 8px; border: 1px solid #e5e7eb; border-radius: 6px; }
.link-btn { background: none; border: none; color: #3b82f6; cursor: pointer; margin-right: 8px; }
.link-btn.danger { color: #dc2626; }
</style>
