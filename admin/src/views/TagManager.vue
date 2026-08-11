<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api, type Tag } from '../api/admin';
import { toast } from '../lib/toast';

const tags = ref<Tag[]>([]);
const newTagName = ref('');
const newTagSlug = ref('');
const filterQuery = ref('');

async function loadTags() {
  tags.value = await api.getTags();
}

const filteredTags = computed(() => {
  if (!filterQuery.value.trim()) return tags.value;
  const q = filterQuery.value.toLowerCase();
  return tags.value.filter((t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q));
});

async function handleAddTag() {
  if (!newTagName.value.trim()) {
    toast.warning('请输入标签名称');
    return;
  }

  const added = await api.addTag(newTagName.value.trim(), newTagSlug.value.trim() || undefined);
  toast.success(`标签 "${added.name}" 已成功添加`);
  newTagName.value = '';
  newTagSlug.value = '';
  loadTags();
}

async function handleDeleteTag(id: number, name: string) {
  if (confirm(`确定要删除标签 "${name}" 吗？`)) {
    await api.deleteTag(id);
    toast.success(`标签 "${name}" 已删除`);
    loadTags();
  }
}

onMounted(() => {
  loadTags();
});
</script>

<template>
  <div class="tag-manager-view">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h2 class="page-title">标签管理</h2>
        <div class="text-muted">所有博文的个性化打标与聚合，可通过胶囊行快速预览与维护</div>
      </div>
    </div>

    <!-- Add Row Card -->
    <div class="card mb-4">
      <div class="card-body">
        <h3 class="card-title fw-bold mb-3">添加新标签</h3>
        <div class="row g-2 align-items-end">
          <div class="col-md-5">
            <label class="form-label small fw-medium">标签名称</label>
            <input
              type="text"
              v-model="newTagName"
              class="form-control"
              placeholder="如：Vue3"
              @keydown.enter="handleAddTag"
            />
          </div>
          <div class="col-md-5">
            <label class="form-label small fw-medium">别名 (Slug)</label>
            <input
              type="text"
              v-model="newTagSlug"
              class="form-control"
              placeholder="如：vue3 (选填)"
              @keydown.enter="handleAddTag"
            />
          </div>
          <div class="col-md-2">
            <button @click="handleAddTag" class="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>添加标签</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Tag Capsule Chips List Card -->
    <div class="card">
      <div class="card-header d-flex justify-content-between align-items-center py-3">
        <h3 class="card-title fw-bold m-0">当前所有标签 (共 {{ tags.length }} 个)</h3>
        <div style="width: 220px;">
          <input
            type="text"
            v-model="filterQuery"
            class="form-control form-control-sm"
            placeholder="筛选标签..."
          />
        </div>
      </div>

      <div class="card-body p-4">
        <div v-if="filteredTags.length === 0" class="text-center text-muted py-4">
          暂无匹配标签
        </div>

        <div class="d-flex flex-wrap gap-2">
          <div
            v-for="tag in filteredTags"
            :key="tag.id"
            class="tag-chip px-3 py-2 fs-4 shadow-xs"
          >
            <span class="fw-semibold text-main">{{ tag.name }}</span>
            <span class="badge badge-soft-secondary ms-1 micro-text">{{ tag.postCount || 0 }}</span>
            <span
              class="tag-remove ms-2"
              @click="handleDeleteTag(tag.id, tag.name)"
              title="删除此标签"
            >
              &times;
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.micro-text {
  font-size: 0.75rem;
}
</style>
