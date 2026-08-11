<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  adminGetTags, adminCreateTag, adminUpdateTag, adminDeleteTag, type TagRow,
} from '../api/admin';
import { toast } from '../lib/toast';

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
  toast('标签已添加', 'success');
  name.value = '';
  load();
}
async function update() {
  if (!editing.value) return;
  await adminUpdateTag(editing.value.id, { name: editing.value.name });
  toast('标签已更新', 'success');
  editing.value = null;
  load();
}
async function remove(id: number) {
  await adminDeleteTag(id);
  toast('标签已删除', 'success');
  load();
}
onMounted(load);
</script>

<template>
  <div>
    <h1 class="page-title">标签管理</h1>
    <div class="add-row">
      <input v-model="name" class="input" placeholder="新标签名称" @keyup.enter="add" />
      <button class="btn primary" @click="add">添加</button>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <div class="tag-list">
      <div v-for="t in list" :key="t.id" class="card tag-chip">
        <template v-if="editing?.id === t.id">
          <input v-model="editing.name" class="input tag-edit" @keyup.enter="update" />
          <button class="btn sm ok" @click="update">存</button>
        </template>
        <template v-else>
          <span>#{{ t.name }}</span>
          <span class="badge">{{ t.postCount }}</span>
          <button class="btn sm" @click="editing = { ...t }">编辑</button>
        </template>
        <button class="btn sm bad" @click="remove(t.id)">删除</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.add-row { display: flex; gap: var(--space-2); margin-bottom: var(--space-4); }
.add-row .input { flex: 1; max-width: 320px; }
.tag-list { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.tag-chip {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  border-radius: var(--radius-full);
  padding: 6px 14px;
  font-size: var(--font-base);
}
.tag-chip .tag-edit { width: 120px; padding: var(--space-1) 10px; font-size: var(--font-sm); }
</style>
