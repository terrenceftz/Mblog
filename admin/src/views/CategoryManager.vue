<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  adminGetCategories, adminCreateCategory, adminUpdateCategory, adminDeleteCategory,
  type CategoryRow,
} from '../api/admin';
import { toast } from '../lib/toast';

const list = ref<CategoryRow[]>([]);
const name = ref('');
const editing = ref<CategoryRow | null>(null);
const error = ref('');

async function load() {
  try {
    list.value = await adminGetCategories();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败';
  }
}
async function add() {
  if (!name.value.trim()) return;
  await adminCreateCategory({ name: name.value });
  toast('分类已添加', 'success');
  name.value = '';
  load();
}
async function update() {
  if (!editing.value) return;
  await adminUpdateCategory(editing.value.id, { name: editing.value.name });
  toast('分类已更新', 'success');
  editing.value = null;
  load();
}
async function remove(id: number) {
  if (!confirm('删除该分类？文章不会删除，仅解除关联。')) return;
  await adminDeleteCategory(id);
  toast('分类已删除', 'success');
  load();
}
onMounted(load);
</script>

<template>
  <div>
    <div class="page-header mb-3"><h1 class="page-title">分类管理</h1></div>
    <div class="add-row">
      <input v-model="name" class="form-control" placeholder="新分类名称" @keyup.enter="add" />
      <button class="btn btn-primary" @click="add">添加</button>
    </div>
    <p v-if="error" class="alert alert-danger py-2">{{ error }}</p>
    <div class="table-responsive">
      <table class="table table-vcenter">
        <thead><tr><th>名称</th><th>slug</th><th>文章数</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="c in list" :key="c.id">
            <td>
              <template v-if="editing?.id === c.id">
                <input v-model="editing.name" class="form-control" @keyup.enter="update" />
              </template>
              <template v-else>{{ c.name }}</template>
            </td>
            <td>{{ c.slug }}</td>
            <td><span class="badge">{{ c.postCount }}</span></td>
            <td class="op-cell">
              <button class="btn btn-outline-secondary btn-sm" @click="editing = { ...c }">编辑</button>
              <button v-if="editing?.id === c.id" class="btn btn-success btn-sm" @click="update">保存</button>
              <button class="btn btn-outline-danger btn-sm" @click="remove(c.id)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.add-row { display: flex; gap: var(--space-2); margin-bottom: var(--space-4); }
.add-row .input { flex: 1; max-width: 320px; }
.table .input { padding: var(--space-1) 10px; font-size: var(--font-sm); }
.op-cell { white-space: nowrap; }
.op-cell .btn { margin-right: var(--space-2); }
.op-cell .btn:last-child { margin-right: 0; }
</style>
