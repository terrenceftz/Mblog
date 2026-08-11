<script setup lang="ts">
// 可搜索的标签多选选择器：选中标签收成可移除胶囊，输入框实时过滤，支持大量标签与内联新建
import { computed, ref } from 'vue';
import { adminCreateTag, type TagRow } from '../api/admin';
import { toast } from '../lib/toast';

const props = defineProps<{ tags: TagRow[]; modelValue: number[] }>();
const emit = defineEmits<{ 'update:modelValue': [number[]] }>();

const allTags = ref<TagRow[]>([...props.tags]);
const query = ref('');

const selected = computed(() => allTags.value.filter((t) => props.modelValue.includes(t.id)));
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return allTags.value.filter(
    (t) => !props.modelValue.includes(t.id) && (!q || t.name.toLowerCase().includes(q)),
  );
});
const canCreate = computed(() => {
  const q = query.value.trim();
  return q.length > 0 && !allTags.value.some((t) => t.name === q);
});

function toggle(t: TagRow) {
  const cur = [...props.modelValue];
  const i = cur.indexOf(t.id);
  if (i >= 0) cur.splice(i, 1);
  else cur.push(t.id);
  emit('update:modelValue', cur);
}
function remove(id: number) {
  emit('update:modelValue', props.modelValue.filter((x) => x !== id));
}
async function create() {
  const name = query.value.trim();
  if (!name || !canCreate.value) return;
  try {
    const created = await adminCreateTag({ name });
    allTags.value.push({ ...created, postCount: 0 });
    emit('update:modelValue', [...props.modelValue, created.id]);
    query.value = '';
    toast(`标签「${name}」已创建`, 'success');
  } catch {
    toast('标签创建失败', 'error');
  }
}
</script>

<template>
  <div class="tag-picker">
    <!-- 已选标签胶囊 -->
    <div v-if="selected.length" class="tag-chips">
      <span v-for="t in selected" :key="t.id" class="chip">
        {{ t.name }}
        <button type="button" class="chip-x" :aria-label="`移除 ${t.name}`" @click="remove(t.id)">✕</button>
      </span>
    </div>

    <div class="tag-search">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input v-model="query" class="input" placeholder="搜索标签…" />
    </div>

    <!-- 匹配选项 + 内联新建 -->
    <div v-if="query.trim() || filtered.length" class="tag-options">
      <button v-if="canCreate" type="button" class="tag-create" @click="create">
        ＋ 创建标签「{{ query.trim() }}」
      </button>
      <button
        v-for="t in filtered"
        :key="t.id"
        type="button"
        class="tag-option"
        @click="toggle(t)"
      >
        {{ t.name }}<span v-if="t.postCount" class="tag-count">{{ t.postCount }}</span>
      </button>
      <p v-if="!filtered.length && !canCreate" class="tag-none">无匹配标签</p>
    </div>
  </div>
</template>

<style scoped>
.tag-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(232, 182, 76, 0.12);
  border: 1px solid rgba(232, 182, 76, 0.4);
  color: #e8b64c;
  border-radius: 999px;
  padding: 3px 8px 3px 11px;
  font-size: 13px;
}
.chip-x {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 11px;
  padding: 0;
  opacity: 0.7;
}
.chip-x:hover {
  opacity: 1;
}
.tag-search {
  position: relative;
}
.tag-search svg {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #5c5c66;
  pointer-events: none;
}
.tag-search input {
  width: 100%;
  box-sizing: border-box;
  padding-left: 30px;
}
.tag-options {
  display: flex;
  flex-direction: column;
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid #26262a;
  border-radius: 8px;
  background: #101014;
  padding: 4px;
}
.tag-option,
.tag-create {
  text-align: left;
  background: none;
  border: none;
  color: #d4d4d8;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.tag-option:hover,
.tag-create:hover {
  background: rgba(232, 182, 76, 0.1);
  color: #e8b64c;
}
.tag-create {
  color: #e8b64c;
  font-weight: 600;
  border-bottom: 1px solid #26262a;
  border-radius: 6px 6px 0 0;
}
.tag-count {
  font-size: 11px;
  color: #5c5c66;
}
.tag-none {
  margin: 0;
  padding: 8px 10px;
  font-size: 13px;
  color: #5c5c66;
}
</style>
