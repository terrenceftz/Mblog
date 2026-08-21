<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api, type Category } from '../api/admin';
import { toast } from '../lib/toast';

const categories = ref<Category[]>([]);
const loading = ref(false);
const uploadingCover = ref(false);

// New Category Form
const newCat = ref({
  name: '',
  slug: '',
  cover: '',
});

// Inline Edit State
const editingId = ref<number | null>(null);
const editForm = ref({
  name: '',
  slug: '',
  cover: '',
});

async function loadCategories() {
  loading.value = true;
  categories.value = await api.getCategories();
  loading.value = false;
}

// 特色图上传：canvas 压缩至 1280px JPEG 0.82 再传（与相册 PhotoManager 同款，减少卡顿）
async function compressImage(file: File): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = URL.createObjectURL(file);
  });
  const max = 1280;
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(img.src);
  return new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b as Blob), 'image/jpeg', 0.82));
}

async function handleCoverUpload(e: Event, target: 'new' | 'edit') {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  uploadingCover.value = true;
  try {
    const blob = await compressImage(file);
    const base = file.name.replace(/\.[^.]+$/, '');
    const url = await api.uploadPhoto(blob, `${base}-cover.jpg`);
    if (target === 'new') newCat.value.cover = url;
    else editForm.value.cover = url;
    toast.success('特色图已上传');
  } catch {
    toast.error('特色图上传失败');
  } finally {
    uploadingCover.value = false;
    (e.target as HTMLInputElement).value = '';
  }
}

async function handleAddCategory() {
  if (!newCat.value.name.trim()) {
    toast.warning('请输入分类名称');
    return;
  }

  const created = await api.saveCategory({
    name: newCat.value.name.trim(),
    slug: newCat.value.slug.trim() || newCat.value.name.trim().toLowerCase().replace(/\s+/g, '-'),
    cover: newCat.value.cover.trim(),
  });

  toast.success(`分类 "${created.name}" 已成功创建`);
  newCat.value = { name: '', slug: '', cover: '' };
  loadCategories();
}

function startEdit(cat: Category) {
  editingId.value = cat.id;
  editForm.value = {
    name: cat.name,
    slug: cat.slug,
    cover: cat.cover,
  };
}

function cancelEdit() {
  editingId.value = null;
}

async function saveEdit(id: number) {
  if (!editForm.value.name.trim()) {
    toast.warning('分类名称不能为空');
    return;
  }

  await api.saveCategory({
    id,
    name: editForm.value.name.trim(),
    slug: editForm.value.slug.trim(),
    cover: editForm.value.cover.trim(),
  });

  toast.success('分类已更新');
  editingId.value = null;
  loadCategories();
}

async function handleDelete(id: number, name: string) {
  if (confirm(`确定要删除分类 "${name}" 吗？`)) {
    await api.deleteCategory(id);
    toast.success(`分类 "${name}" 已删除`);
    loadCategories();
  }
}

onMounted(() => {
  loadCategories();
});
</script>

<template>
  <div class="category-manager-view">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h2 class="page-title">分类管理</h2>
        <div class="text-muted">管理文章的聚合分类，支持添加与表格内实时行内编辑</div>
      </div>
    </div>

    <!-- Add Category Bar -->
    <div class="card mb-4">
      <div class="card-body">
        <h3 class="card-title fw-bold mb-3">添加新分类</h3>
        <div class="row g-2 align-items-end">
          <div class="col-md-3">
            <label class="form-label small fw-medium">分类名称</label>
            <input
              type="text"
              v-model="newCat.name"
              class="form-control"
              placeholder="如：技术心得"
            />
          </div>
          <div class="col-md-2">
            <label class="form-label small fw-medium">别名 (Slug)</label>
            <input
              type="text"
              v-model="newCat.slug"
              class="form-control"
              placeholder="如：tech"
            />
          </div>
          <div class="col-md-3">
            <label class="form-label small fw-medium">特色图 URL（可选，分类页卡片背景）</label>
            <div class="d-flex gap-2">
              <input
                type="text"
                v-model="newCat.cover"
                class="form-control"
                placeholder="https:// 或 /uploads/..."
              />
              <label class="btn btn-ghost-primary mb-0 text-nowrap" :class="{ disabled: uploadingCover }">
                <span v-if="uploadingCover">上传中…</span>
                <span v-else>上传</span>
                <input type="file" accept="image/*" class="d-none" @change="handleCoverUpload($event, 'new')" />
              </label>
            </div>
          </div>
          <div class="col-md-1">
            <button @click="handleAddCategory" class="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>添加</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Category List Table -->
    <div class="card">
      <div class="table-responsive">
        <table class="table table-vcenter card-table">
          <thead>
            <tr>
              <th style="width: 22%">分类名称</th>
              <th style="width: 18%">别名 (Slug)</th>
              <th style="width: 28%">特色图</th>
              <th class="text-center">文章数</th>
              <th class="text-end">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cat in categories" :key="cat.id">
              <!-- Regular Display Mode -->
              <template v-if="editingId !== cat.id">
                <td class="fw-bold text-main">{{ cat.name }}</td>
                <td><code class="text-primary">{{ cat.slug }}</code></td>
                <td>
                  <img v-if="cat.cover" :src="cat.cover" class="rounded" style="width: 72px; height: 40px; object-fit: cover;" alt="分类特色图" />
                  <span v-else class="text-muted small">未设置</span>
                </td>
                <td class="text-center">
                  <span class="badge badge-soft-primary">{{ cat.postCount || 0 }} 篇</span>
                </td>
                <td class="text-end">
                  <div class="btn-list flex-nowrap justify-content-end">
                    <button @click="startEdit(cat)" class="btn btn-sm btn-ghost-primary">编辑</button>
                    <button @click="handleDelete(cat.id, cat.name)" class="btn btn-sm btn-ghost-danger">删除</button>
                  </div>
                </td>
              </template>

              <!-- Inline Edit Mode -->
              <template v-else>
                <td>
                  <input type="text" v-model="editForm.name" class="form-control form-control-sm fw-bold" />
                </td>
                <td>
                  <input type="text" v-model="editForm.slug" class="form-control form-control-sm font-monospace" />
                </td>
                <td>
                  <div class="d-flex gap-2 align-items-center">
                    <img v-if="editForm.cover" :src="editForm.cover" class="rounded flex-shrink-0" style="width: 72px; height: 40px; object-fit: cover;" alt="预览" />
                    <div class="d-flex flex-column gap-1 flex-grow-1" style="min-width: 0">
                      <input type="text" v-model="editForm.cover" class="form-control form-control-sm" placeholder="/uploads/... 或 https://..." />
                      <div class="btn-list">
                        <label class="btn btn-sm btn-ghost-primary mb-0" :class="{ disabled: uploadingCover }">
                          <span v-if="uploadingCover">上传中…</span>
                          <span v-else>上传</span>
                          <input type="file" accept="image/*" class="d-none" @change="handleCoverUpload($event, 'edit')" />
                        </label>
                        <button v-if="editForm.cover" @click="editForm.cover = ''" class="btn btn-sm btn-ghost-danger">清除</button>
                      </div>
                    </div>
                  </div>
                </td>
                <td class="text-center">
                  <span class="badge badge-soft-primary">{{ cat.postCount || 0 }} 篇</span>
                </td>
                <td class="text-end">
                  <div class="btn-list flex-nowrap justify-content-end">
                    <button @click="saveEdit(cat.id)" class="btn btn-sm btn-success">保存</button>
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
