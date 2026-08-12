<script setup lang="ts">
// 相册管理：本地上传（选图后本地压缩到 1600px 再传，减少卡顿）+ 外部 URL + 编辑标题 + 删除
import { ref, onMounted } from 'vue';
import { api, type Photo } from '../api/admin';
import { toast } from '../lib/toast';

const photos = ref<Photo[]>([]);
const loading = ref(false);
const uploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const newTitle = ref('');
const newUrl = ref('');
const selectedName = ref('');
const selectedSize = ref('');

const MAX_EDGE = 1600;

async function loadPhotos() {
  loading.value = true;
  photos.value = await api.getPhotos();
  loading.value = false;
}

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function onFileChange() {
  const file = fileInput.value?.files?.[0];
  selectedName.value = file?.name ?? '';
  selectedSize.value = file ? formatSize(file.size) : '';
}

/** 本地压缩大图到 MAX_EDGE 内（JPEG 0.82）；失败或小图直传原文件 */
async function compressImage(file: File): Promise<Blob> {
  try {
    const img = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    if (scale === 1) {
      img.close?.();
      return file;
    }
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
    img.close?.();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.82));
    return blob ?? file;
  } catch {
    return file;
  }
}

async function handleUpload() {
  const file = fileInput.value?.files?.[0];
  if (!file) {
    toast.warning('请先选择图片');
    return;
  }
  uploading.value = true;
  try {
    const blob = await compressImage(file);
    const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
    const url = await api.uploadPhoto(blob, `${base}.jpg`);
    await api.createPhoto({ url, title: newTitle.value.trim() });
    toast.success('照片已上传');
    newTitle.value = '';
    selectedName.value = '';
    selectedSize.value = '';
    if (fileInput.value) fileInput.value.value = '';
    loadPhotos();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '上传失败');
  } finally {
    uploading.value = false;
  }
}

async function handleAddByUrl() {
  const url = newUrl.value.trim();
  if (!url) {
    toast.warning('请输入图片地址');
    return;
  }
  await api.createPhoto({ url, title: newTitle.value.trim() });
  toast.success('照片已添加');
  newUrl.value = '';
  newTitle.value = '';
  loadPhotos();
}

async function handleEditTitle(p: Photo) {
  const input = window.prompt('修改标题（留空删除标题）', p.title);
  if (input === null) return;
  await api.updatePhoto(p.id, { title: input.trim() });
  toast.success('标题已更新');
  loadPhotos();
}

async function handleDelete(p: Photo) {
  if (confirm(`确定删除这张照片吗？\n${p.title || p.url}`)) {
    await api.deletePhoto(p.id);
    toast.success('照片已删除');
    loadPhotos();
  }
}

onMounted(loadPhotos);
</script>

<template>
  <div class="photo-manager-view">
    <div class="page-header">
      <div>
        <h2 class="page-title">相册管理</h2>
        <div class="text-muted">上传或粘贴图片地址，前台瀑布流展示</div>
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-body">
        <h3 class="card-title fw-bold mb-3">添加照片</h3>
        <div class="row g-3 align-items-end">
          <div class="col-md-5">
            <label class="form-label">本地上传</label>
            <input ref="fileInput" type="file" accept="image/*" class="form-control" @change="onFileChange" />
            <div v-if="selectedName" class="text-muted micro-text mt-1">
              {{ selectedName }}（{{ selectedSize }}）· 上传前自动压缩至 1600px
            </div>
          </div>
          <div class="col-md-3">
            <label class="form-label">标题（可选）</label>
            <input v-model="newTitle" class="form-control" maxlength="100" placeholder="照片标题" />
          </div>
          <div class="col-md-2">
            <button @click="handleUpload" class="btn btn-primary w-100" :disabled="uploading">
              {{ uploading ? '上传中…' : '上传' }}
            </button>
          </div>
        </div>
        <div class="row g-3 align-items-end mt-2">
          <div class="col-md-7">
            <label class="form-label">或粘贴图片地址（https://…）</label>
            <input v-model="newUrl" class="form-control" placeholder="https://example.com/photo.jpg" />
          </div>
          <div class="col-md-2">
            <button @click="handleAddByUrl" class="btn btn-outline-primary w-100">添加</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header py-3">
        <h3 class="card-title fw-bold m-0">照片列表 (共 {{ photos.length }} 张)</h3>
      </div>
      <div class="card-body">
        <div v-if="loading" class="text-center text-muted py-5">加载中…</div>
        <div v-else-if="photos.length === 0" class="text-center text-muted py-5">相册还是空的，先添加几张吧</div>
        <div v-else class="row g-3">
          <div v-for="p in photos" :key="p.id" class="col-6 col-md-4 col-lg-3">
            <div class="card h-100">
              <img :src="p.url" class="card-img-top" :alt="p.title || '照片'" style="height: 160px; object-fit: cover;" loading="lazy" />
              <div class="card-body p-2 d-flex flex-column gap-1">
                <div class="text-truncate small">{{ p.title || '（无标题）' }}</div>
                <div class="text-muted micro-text font-monospace">{{ p.created_at }}</div>
                <div class="d-flex gap-1 mt-auto">
                  <button @click="handleEditTitle(p)" class="btn btn-sm btn-outline-primary">标题</button>
                  <button @click="handleDelete(p)" class="btn btn-sm btn-ghost-danger">删除</button>
                </div>
              </div>
            </div>
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
