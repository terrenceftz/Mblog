<script setup lang="ts">
// 相册管理：本地上传（选图后本地压缩到 1600px 再传，减少卡顿）+ 外部 URL + 编辑标题/分组 + 删除
// 上传时顺带解析 EXIF（机型/光圈/快门/焦距/ISO/时间）——必须在 canvas 压缩前读原始文件（压缩会洗掉元数据）
import { ref, computed, onMounted } from 'vue';
import ExifReader from 'exifreader';
import { api, type Photo } from '../api/admin';
import { toast } from '../lib/toast';

const photos = ref<Photo[]>([]);
const loading = ref(false);
const uploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const newTitle = ref('');
const newAlbum = ref('');
const newUrl = ref('');
const albumFilter = ref('全部');
const selectedName = ref('');
const selectedSize = ref('');

const MAX_EDGE = 1600;

// 所有分组（供筛选下拉与新增表单的 datalist 提示）
const albums = computed(() => {
  const set = new Set<string>();
  for (const p of photos.value) if (p.album.trim()) set.add(p.album.trim());
  return [...set];
});
const filteredPhotos = computed(() => {
  if (albumFilter.value === '全部') return photos.value;
  return photos.value.filter((p) => p.album.trim() === albumFilter.value);
});

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

/** 读取 EXIF 摘要（JSON：model/aperture/shutter/focal/iso/takenAt）；无 EXIF 或解析失败返回空串 */
async function readExif(file: File): Promise<string> {
  try {
    const tags = ExifReader.load(await file.arrayBuffer());
    const pick = (keys: string[]) => {
      for (const k of keys) {
        const d = (tags[k] as { description?: unknown } | undefined)?.description;
        if (typeof d === 'string' && d.trim()) return d.trim();
        if (typeof d === 'number') return String(d);
      }
      return '';
    };
    // 快门展示规整：小数秒转 1/x；ExifReader 常给 "0.004" 或 "1/250"
    const rawShutter = pick(['ExposureTime']);
    let shutter = rawShutter;
    const asNum = Number(rawShutter.replace(/[^0-9./]/g, ''));
    if (rawShutter && !rawShutter.includes('/') && Number.isFinite(asNum) && asNum > 0 && asNum < 1) {
      shutter = `1/${Math.round(1 / asNum)}s`;
    } else if (rawShutter) {
      shutter = rawShutter.replace(/\s*s$/, 's');
    }
    const parts = {
      model: pick(['Model', 'CameraModel', 'Make']),
      aperture: pick(['FNumber', 'ApertureValue']),
      shutter,
      focal: pick(['FocalLengthIn35mmFormat', 'FocalLength']),
      iso: pick(['ISOSpeedRatings', 'ISOSpeed', 'ISO']),
      takenAt: pick(['DateTimeOriginal', 'DateTime']).replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'),
    };
    return Object.values(parts).some(Boolean) ? JSON.stringify(parts) : '';
  } catch {
    return '';
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
    const exif = await readExif(file);
    const blob = await compressImage(file);
    const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
    const url = await api.uploadPhoto(blob, `${base}.jpg`);
    await api.createPhoto({ url, title: newTitle.value.trim(), album: newAlbum.value.trim(), exif });
    toast.success('照片已上传');
    newTitle.value = '';
    newAlbum.value = '';
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
  await api.createPhoto({ url, title: newTitle.value.trim(), album: newAlbum.value.trim() });
  toast.success('照片已添加');
  newUrl.value = '';
  newTitle.value = '';
  newAlbum.value = '';
  loadPhotos();
}

async function handleEditTitle(p: Photo) {
  const input = window.prompt('修改标题（留空删除标题）', p.title);
  if (input === null) return;
  await api.updatePhoto(p.id, { title: input.trim() });
  toast.success('标题已更新');
  loadPhotos();
}

async function handleEditAlbum(p: Photo) {
  const input = window.prompt('修改相册分组（留空归「全部」）', p.album);
  if (input === null) return;
  await api.updatePhoto(p.id, { album: input.trim() });
  toast.success('分组已更新');
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
            <label class="form-label">相册分组</label>
            <input v-model="newAlbum" list="album-options" class="form-control" maxlength="50" placeholder="如：旅行" />
            <datalist id="album-options">
              <option v-for="a in albums" :key="a" :value="a" />
            </datalist>
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
      <div class="card-header py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <h3 class="card-title fw-bold m-0">照片列表 (共 {{ photos.length }} 张)</h3>
        <div class="d-flex align-items-center gap-2">
          <label class="form-label small text-muted m-0">按分组：</label>
          <select v-model="albumFilter" class="form-select form-select-sm" style="width: auto">
            <option value="全部">全部</option>
            <option v-for="a in albums" :key="a" :value="a">{{ a }}</option>
          </select>
        </div>
      </div>
      <div class="card-body">
        <div v-if="loading" class="text-center text-muted py-5">加载中…</div>
        <div v-else-if="filteredPhotos.length === 0" class="text-center text-muted py-5">该分组暂无照片</div>
        <div v-else class="row g-3">
          <div v-for="p in filteredPhotos" :key="p.id" class="col-6 col-md-4 col-lg-3">
            <div class="card h-100">
              <img :src="p.url" class="card-img-top" :alt="p.title || '照片'" style="height: 160px; object-fit: cover;" loading="lazy" />
              <div class="card-body p-2 d-flex flex-column gap-1">
                <div class="text-truncate small">{{ p.title || '（无标题）' }}</div>
                <div class="d-flex align-items-center gap-1">
                  <span v-if="p.album" class="badge text-bg-secondary font-monospace">{{ p.album }}</span>
                  <span v-else class="badge text-bg-light text-muted font-monospace">全部</span>
                </div>
                <div class="text-muted micro-text font-monospace">{{ p.created_at }}</div>
                <div class="d-flex gap-1 mt-auto flex-wrap">
                  <button @click="handleEditTitle(p)" class="btn btn-sm btn-outline-primary">标题</button>
                  <button @click="handleEditAlbum(p)" class="btn btn-sm btn-outline-secondary">分组</button>
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
