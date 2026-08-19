<script setup lang="ts">
// 合集/专栏管理：系列文章聚合（如「vibe-coding 系列」）。表格行内编辑，样式对齐 CategoryManager。
import { ref, onMounted } from 'vue';
import { api, type Collection } from '../api/admin';
import { toast } from '../lib/toast';

const collections = ref<Collection[]>([]);
const loading = ref(false);

const newCol = ref({
  name: '',
  slug: '',
  description: '',
});

const editingId = ref<number | null>(null);
const editForm = ref({
  name: '',
  slug: '',
  description: '',
});

async function loadCollections() {
  loading.value = true;
  collections.value = await api.getCollections();
  loading.value = false;
}

async function handleAdd() {
  if (!newCol.value.name.trim()) {
    toast.warning('请输入合集名称');
    return;
  }
  const created = await api.saveCollection({
    name: newCol.value.name.trim(),
    slug: newCol.value.slug.trim() || newCol.value.name.trim().toLowerCase().replace(/\s+/g, '-'),
    description: newCol.value.description.trim(),
  });
  toast.success(`合集 "${created.name}" 已创建`);
  newCol.value = { name: '', slug: '', description: '' };
  loadCollections();
}

function startEdit(col: Collection) {
  editingId.value = col.id;
  editForm.value = { name: col.name, slug: col.slug, description: col.description };
}

function cancelEdit() {
  editingId.value = null;
}

async function saveEdit(id: number) {
  if (!editForm.value.name.trim()) {
    toast.warning('合集名称不能为空');
    return;
  }
  await api.saveCollection({
    id,
    name: editForm.value.name.trim(),
    slug: editForm.value.slug.trim(),
    description: editForm.value.description.trim(),
  });
  toast.success('合集已更新');
  editingId.value = null;
  loadCollections();
}

async function handleDelete(col: Collection) {
  if (confirm(`确定删除合集 "${col.name}" 吗？\n合集下的文章不会被删除，只是不再归属该合集。`)) {
    await api.deleteCollection(col.id);
    toast.success(`合集 "${col.name}" 已删除`);
    loadCollections();
  }
}

onMounted(loadCollections);
</script>

<template>
  <div class="collection-manager-view">
    <div class="page-header">
      <div>
        <h2 class="page-title">合集管理</h2>
        <div class="text-muted">系列文章聚合（如教程连载），前台 /collection/[slug] 按写作顺序展示</div>
      </div>
    </div>

    <!-- 添加合集 -->
    <div class="card mb-4">
      <div class="card-body">
        <h3 class="card-title fw-bold mb-3">添加新合集</h3>
        <div class="row g-2 align-items-end">
          <div class="col-md-3">
            <label class="form-label small fw-medium">合集名称</label>
            <input type="text" v-model="newCol.name" class="form-control" placeholder="如：vibe-coding 系列" />
          </div>
          <div class="col-md-2">
            <label class="form-label small fw-medium">别名 (Slug)</label>
            <input type="text" v-model="newCol.slug" class="form-control" placeholder="如：vibe-coding" />
          </div>
          <div class="col-md-4">
            <label class="form-label small fw-medium">描述</label>
            <input type="text" v-model="newCol.description" class="form-control" placeholder="系列简介（前台合集页展示）" />
          </div>
          <div class="col-md-3">
            <button @click="handleAdd" class="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>添加</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 合集列表 -->
    <div class="card">
      <div class="table-responsive">
        <table class="table table-vcenter card-table">
          <thead>
            <tr>
              <th style="width: 24%">合集名称</th>
              <th style="width: 20%">别名 (Slug)</th>
              <th style="width: 34%">描述</th>
              <th class="text-center">文章数</th>
              <th class="text-end">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading && collections.length === 0">
              <td colspan="5" class="text-center text-muted py-4">加载中…</td>
            </tr>
            <tr v-else-if="collections.length === 0">
              <td colspan="5" class="text-center text-muted py-4">还没有合集，先创建一个吧</td>
            </tr>
            <tr v-for="col in collections" :key="col.id">
              <template v-if="editingId !== col.id">
                <td class="fw-bold text-main">{{ col.name }}</td>
                <td><code class="text-primary">{{ col.slug }}</code></td>
                <td class="text-muted small">{{ col.description || '暂无描述' }}</td>
                <td class="text-center">
                  <span class="badge badge-soft-primary">{{ col.postCount || 0 }} 篇</span>
                </td>
                <td class="text-end">
                  <div class="btn-list flex-nowrap justify-content-end">
                    <button @click="startEdit(col)" class="btn btn-sm btn-ghost-primary">编辑</button>
                    <button @click="handleDelete(col)" class="btn btn-sm btn-ghost-danger">删除</button>
                  </div>
                </td>
              </template>
              <template v-else>
                <td><input type="text" v-model="editForm.name" class="form-control form-control-sm fw-bold" /></td>
                <td><input type="text" v-model="editForm.slug" class="form-control form-control-sm font-monospace" /></td>
                <td><input type="text" v-model="editForm.description" class="form-control form-control-sm" /></td>
                <td class="text-center">
                  <span class="badge badge-soft-primary">{{ col.postCount || 0 }} 篇</span>
                </td>
                <td class="text-end">
                  <div class="btn-list flex-nowrap justify-content-end">
                    <button @click="saveEdit(col.id)" class="btn btn-sm btn-success">保存</button>
                    <button @click="cancelEdit" class="btn btn-sm btn-secondary">取消</button>
                  </div>
                </td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
