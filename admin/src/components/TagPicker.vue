<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { api, type Tag } from '../api/admin';

const props = defineProps<{
  modelValue: string[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void;
}>();

const allTags = ref<Tag[]>([]);
const searchInput = ref('');
const isOpen = ref(false);
const containerRef = ref<HTMLElement | null>(null);

const availableTags = computed(() => {
  const query = searchInput.value.trim().toLowerCase();
  return allTags.value.filter((tag) => {
    const isAlreadySelected = props.modelValue.includes(tag.name);
    if (isAlreadySelected) return false;
    if (!query) return true;
    return tag.name.toLowerCase().includes(query) || tag.slug.toLowerCase().includes(query);
  });
});

async function loadTags() {
  allTags.value = await api.getTags();
}

function selectTag(tagName: string) {
  if (!props.modelValue.includes(tagName)) {
    emit('update:modelValue', [...props.modelValue, tagName]);
  }
  searchInput.value = '';
}

function removeTag(tagName: string) {
  emit(
    'update:modelValue',
    props.modelValue.filter((t) => t !== tagName)
  );
}

async function handleCreateTag() {
  const name = searchInput.value.trim();
  if (!name) return;
  if (props.modelValue.includes(name)) {
    searchInput.value = '';
    return;
  }
  // Add to tag list via API if not present
  const newTag = await api.addTag(name);
  if (!allTags.value.some((t) => t.id === newTag.id)) {
    allTags.value.push(newTag);
  }
  selectTag(newTag.name);
  searchInput.value = '';
}

function handleClickOutside(event: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
}

onMounted(() => {
  loadTags();
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div ref="containerRef" class="tag-picker-container position-relative">
    <div class="tag-picker-box d-flex flex-wrap align-items-center gap-1 p-2 rounded border bg-input" @click="isOpen = true">
      <!-- Selected Tag Chips -->
      <span v-for="tag in modelValue" :key="tag" class="tag-chip">
        <span>{{ tag }}</span>
        <span class="tag-remove" @click.stop="removeTag(tag)">&times;</span>
      </span>

      <!-- Input for searching / creating -->
      <input
        type="text"
        v-model="searchInput"
        class="form-control-plaintext form-control-sm flex-grow-1 min-w-0 px-1 py-0 shadow-none"
        placeholder="搜索或输入回车添加标签..."
        @focus="isOpen = true"
        @keydown.enter.prevent="handleCreateTag"
      />
    </div>

    <!-- Dropdown Menu -->
    <div v-if="isOpen" class="dropdown-menu show w-100 mt-1 shadow-sm border p-1 max-h-48 overflow-auto" style="z-index: 1050; max-height: 200px;">
      <div v-if="availableTags.length === 0 && !searchInput.trim()" class="text-muted p-2 small text-center">
        暂无更多标签
      </div>

      <div v-else-if="availableTags.length === 0 && searchInput.trim()" class="dropdown-item rounded py-1 px-2 cursor-pointer small" @click="handleCreateTag">
        按 Enter 创建新标签 <span class="fw-bold text-primary">"{{ searchInput }}"</span>
      </div>

      <div
        v-for="tag in availableTags"
        :key="tag.id"
        class="dropdown-item rounded py-1 px-2 cursor-pointer small d-flex align-items-center justify-content-between"
        @click="selectTag(tag.name)"
      >
        <span>{{ tag.name }}</span>
        <span class="badge badge-soft-secondary ms-2">{{ tag.postCount || 0 }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.min-w-0 {
  min-width: 100px;
}
.bg-input {
  background-color: var(--mb-bg-input);
  border-color: var(--mb-border-color) !important;
}
.tag-picker-box {
  min-height: 42px;
  cursor: text;
}
</style>
