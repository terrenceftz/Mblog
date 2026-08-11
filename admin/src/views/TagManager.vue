<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  adminGetTags, adminCreateTag, adminUpdateTag, adminDeleteTag, type TagRow,
} from '../api/admin';

const list = ref<TagRow[]>([]);
const name = ref('');
const editing = ref<TagRow | null>(null);
const error = ref('');

async function load() {
  try {
    list.value = await adminGetTags();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败';
  }
}
async function add() {
  if (!name.value.trim()) return;
  await adminCreateTag({ name: name.value });
  name.value = '';
  load();
}
async function update() {
  if (!editing.value) return;
  await adminUpdateTag(editing.value.id, { name: editing.value.name });
  editing.value = null;
  load();
}
async function remove(id: number) {
  await adminDeleteTag(id);
  load();
}
onMounted(load);
</script>

<template>
  <div>
    <h1 class="page-title">标签管理</h1>
    <div class="add-row">
      <input v-model="name" placeholder="新标签名称" @keyup.enter="add" />
      <button class="btn primary" @click="add">添加</button>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <div class="tag-list">
      <div v-for="t in list" :key="t.id" class="tag-chip">
        <template v-if="editing?.id === t.id">
          <input v-model="editing.name" @keyup.enter="update" />
          <button class="link-btn" @click="update">存</button>
        </template>
        <template v-else>
          <span>#{{ t.name }}（{{ t.postCount }}）</span>
          <button class="link-btn" @click="editing = { ...t }">编辑</button>
        </template>
        <button class="link-btn danger" @click="remove(t.id)">删除</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-title { font-size: 22px; margin-bottom: 20px; }
.add-row { display: flex; gap: 10px; margin-bottom: 16px; }
.add-row input { flex: 1; max-width: 320px; padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 8px; }
.btn { border: none; border-radius: 8px; padding: 8px 16px; cursor: pointer; }
.btn.primary { background: #3b82f6; color: #fff; }
.tag-list { display: flex; flex-wrap: wrap; gap: 10px; }
.tag-chip { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #e5e7eb; border-radius: 999px; padding: 6px 14px; font-size: 14px; }
.tag-chip input { width: 100px; padding: 4px 8px; border: 1px solid #e5e7eb; border-radius: 6px; }
.link-btn { background: none; border: none; color: #3b82f6; cursor: pointer; font-size: 13px; }
.link-btn.danger { color: #dc2626; }
.error { color: #dc2626; font-size: 14px; margin: 0 0 8px; }
</style>
