<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, shallowRef } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import type Vditor from 'vditor';
import 'vditor/dist/index.css';
import { api, type Post, type Category, type Collection } from '../api/admin';
import { toast } from '../lib/toast';
import TagPicker from '../components/TagPicker.vue';

const route = useRoute();
const router = useRouter();

const postId = computed(() => {
  const idParam = route.params.id;
  if (!idParam || idParam === 'new') return null;
  return Number(idParam);
});

const isEditMode = computed(() => postId.value !== null);

const categories = ref<Category[]>([]);
const collections = ref<Collection[]>([]);
const loading = ref(false);
const saving = ref(false);

const postForm = ref<{
  title: string;
  slug: string;
  content: string;
  summary: string;
  categoryId: number;
  collectionId: number | null;
  tags: string[];
  status: 'published' | 'draft';
  cover: string;
}>({
  title: '',
  slug: '',
  content: '',
  summary: '',
  categoryId: 1,
  collectionId: null,
  tags: [],
  status: 'published',
  cover: '',
});

const wordCount = computed(() => {
  return postForm.value.content.trim().length;
});

const DRAFT_KEY = `mblog_admin_draft_${isEditMode.value ? `edit_${postId.value}` : 'new'}`;
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
let autoSavePending = false;
let restoringDraft = true;
/** 后端草稿行 id：新建页自动保存首次 POST 产生，之后自动保存改 PUT 该行 */
const draftId = ref<number | null>(null);
/** 用户是否显式保存过（发布/存草稿）：新建页在显式保存前，自动保存一律落草稿，避免直接发布 */
let statusManuallySet = false;

function writeLocalDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(postForm.value));
  } catch {
    /* 忽略存储失败 */
  }
}

function scheduleAutoSave() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    void persistDraft();
  }, 3000);
}

/** 取消待触发的自动保存定时器（显式保存后调用，防止把刚发布的内容再存回草稿） */
function clearAutoSaveTimer() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = null;
}

/** 草稿自动保存到后端。状态规则：编辑态沿用表单当前状态（编辑已发布文章不降级为草稿）；
 *  新建页在用户显式保存前一律落草稿（避免有字即发布），显式保存后沿用表单状态。失败静默，本地草稿兜底。 */
async function persistDraft() {
  if (autoSavePending) return;
  const f = postForm.value;
  if (!f.title.trim() && !f.content.trim()) return;
  autoSavePending = true;
  try {
    // 新建页：首次自动保存建草稿行（draft）；编辑态或已建过草稿/显式保存过 → 沿用当前 status
    const targetStatus: 'draft' | 'published' =
      !isEditMode.value && !statusManuallySet && draftId.value === null ? 'draft' : f.status;
    const saved = await api.savePost({
      id: postId.value ?? draftId.value ?? undefined,
      title: f.title || '无标题草稿',
      slug: f.slug,
      content: f.content,
      summary: f.summary,
      categoryId: f.categoryId,
      collectionId: f.collectionId,
      tags: f.tags,
      status: targetStatus,
      cover: f.cover,
    });
    draftId.value = saved.id;
  } catch {
    // 后端自动保存失败不打断编辑，本地草稿继续兜底
  } finally {
    autoSavePending = false;
    writeLocalDraft();
  }
}

function clearAutoSave() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* 忽略 */
  }
}

async function loadData() {
  categories.value = await api.getCategories();
  collections.value = await api.getCollections().catch(() => []);

  // 新建页：恢复本地草稿
  if (!isEditMode.value) {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && typeof d === 'object' && typeof d.title === 'string') {
          postForm.value = {
            ...postForm.value,
            ...d,
            tags: Array.isArray(d.tags) ? d.tags : [],
            status: (d.status === 'published' || d.status === 'draft') ? d.status : 'published',
          };
        }
      }
    } catch {
      /* 忽略 */
    }
  }

  if (isEditMode.value) {
    loading.value = true;
    const existing = await api.getPostById(postId.value!);
    if (existing) {
      postForm.value = {
        title: existing.title,
        slug: existing.slug,
        content: existing.content,
        summary: existing.summary,
        categoryId: existing.categoryId,
        collectionId: existing.collectionId ?? null,
        tags: [...existing.tags],
        status: existing.status,
        cover: existing.cover,
      };
    } else {
      toast.error('未找到该文章');
      router.push('/posts');
    }
    loading.value = false;
  }
}

async function handleSave(status?: 'published' | 'draft') {
  if (!postForm.value.title.trim()) {
    toast.warning('请输入文章标题');
    return;
  }

  if (status) {
    postForm.value.status = status;
    statusManuallySet = true;
  }

  saving.value = true;
  try {
    const selectedCat = categories.value.find((c) => c.id === postForm.value.categoryId);
    const saved = await api.savePost({
      id: postId.value ?? draftId.value ?? undefined,
      ...postForm.value,
      categoryName: selectedCat ? selectedCat.name : '未分类',
    });
    draftId.value = saved.id;
    statusManuallySet = true;
    clearAutoSaveTimer();
    autoSavePending = false;
    dirty.value = false;

    toast.success(status === 'draft' ? '草稿保存成功' : '文章已成功发布！');
    clearAutoSave();
    if (!isEditMode.value) {
      router.push(`/posts/${saved.id}`);
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '保存失败，请检查数据');
  } finally {
    saving.value = false;
  }
}

let vditor: InstanceType<typeof Vditor> | null = null;
let vditorReady = false;

// 音频插入（Vditor 工具栏自定义按钮）
const audioButton = {
  name: 'insertAudio',
  icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.4 5.6a9 9 0 0 1 0 12.8"/></svg>',
  tip: '插入音频',
  click: () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !vditor) return;
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/admin/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('admin_token') ?? ''}` },
          body: form,
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error?.message ?? '上传失败');
        vditor.insertValue(`<audio controls src="${body.data.url}"></audio>
`, true);
        markDirty();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '音频上传失败');
      }
    };
    input.click();
  },
};

// 封面上传
const coverUploading = ref(false);
async function uploadCover() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    coverUploading.value = true;
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token') ?? ''}` },
        body: form,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? '上传失败');
      postForm.value.cover = body.data.url;
      markDirty();
      toast.success('封面上传成功');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '封面上传失败');
    } finally {
      coverUploading.value = false;
    }
  };
  input.click();
}

// 未保存修改保护
const dirty = ref(false);
function markDirty() {
  dirty.value = true;
}
onBeforeRouteLeave(() => {
  if (!dirty.value) return true;
  return window.confirm('有未保存的修改，确定要离开吗？');
});

// 主题联动：跟随 data-bs-theme（暗色 → dark，浅色 → classic）
function vditorTheme(): 'dark' | 'classic' {
  return document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'classic';
}

async function initVditor() {
  if (vditorReady) return;
  vditorReady = true;
  // 动态加载 vditor（~300KB）：编辑器外壳先渲染，库到位后再初始化
  const { default: VditorCtor } = await import('vditor');
  vditor = new VditorCtor('vditor', {
    height: 480,
    mode: 'wysiwyg',
    theme: vditorTheme(),
    toolbar: [
      'headings', 'bold', 'italic', 'strike', '|',
      'list', 'ordered-list', 'check', 'quote', '|',
      'code', 'inline-code', 'table', '|',
      'link', 'upload', audioButton, '|', 'undo', 'redo', '|', 'fullscreen',
    ],
    cache: { enable: false },
    upload: {
      url: '/api/admin/upload',
      fieldName: 'file',
      headers: { Authorization: `Bearer ${localStorage.getItem('admin_token') ?? ''}` },
      filename: (name: string) => name,
      accept: 'image/*',
      // 逐个文件建立 原名 → URL 映射，避免多图上传互相覆盖（旧实现所有文件同名只插一张）
      format: (files, responseText) => {
        let url = '';
        try {
          url = (JSON.parse(responseText) as { data?: { url?: string } })?.data?.url ?? '';
        } catch {
          url = '';
        }
        const succMap: Record<string, string> = {};
        for (const f of files) {
          if (f.name) succMap[f.name] = url;
        }
        return JSON.stringify({
          code: 0,
          msg: '',
          data: { errFiles: [], succMap },
        });
      },
    },
    input: (value: string) => {
      postForm.value.content = value;
      markDirty();
    },
    after: () => {
      if (vditor) vditor.setValue(postForm.value.content);
    },
  });
}

// 暗色/浅色切换时联动 Vditor
watch(
  () => document.documentElement.getAttribute('data-bs-theme'),
  () => vditor?.setTheme(vditorTheme())
);

// 自动保存：表单变化后 3s 写入 localStorage（恢复期与编辑态加载期不触发）
watch(
  postForm,
  () => {
    if (!restoringDraft && vditorReady) scheduleAutoSave();
  },
  { deep: true }
);

onMounted(async () => {
  await loadData();
  // 等 DOM 渲染完成再初始化 Vditor
  setTimeout(() => {
    restoringDraft = false;
    initVditor();
  }, 50);
});

onUnmounted(() => {
  clearAutoSaveTimer();
  try {
    vditor?.destroy();
  } catch {
    /* 销毁异常忽略 */
  }
  vditor = null;
  vditorReady = false;
});
</script>

<template>
  <div class="post-editor-view">
    <!-- Page Header Topbar -->
    <div class="page-header">
      <div class="d-flex align-items-center gap-2">
        <router-link to="/posts" class="btn btn-sm btn-ghost-secondary rounded-circle" title="返回文章列表">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
        </router-link>
        <div>
          <h2 class="page-title">{{ isEditMode ? '编辑文章' : '撰写新文章' }}</h2>
          <div class="text-muted">采用 Vditor 双栏协同编排</div>
        </div>
      </div>

      <div class="d-flex align-items-center gap-2">
        <button
          type="button"
          class="btn btn-outline-secondary d-flex align-items-center gap-1"
          :disabled="saving"
          @click="handleSave('draft')"
        >
          保存草稿
        </button>
        <button
          type="button"
          class="btn btn-primary d-flex align-items-center gap-1 shadow-sm"
          :disabled="saving"
          @click="handleSave('published')"
        >
          <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
          <span>发布文章</span>
        </button>
      </div>
    </div>

    <!-- Main Dual Column Layout -->
    <div class="row g-4">
      <!-- Left Column: Title & Vditor Markdown Editor -->
      <div class="col-lg-8">
        <!-- Title & Slug Card -->
        <div class="card mb-3 p-3">
          <input
            type="text"
            v-model="postForm.title"
            class="form-control form-control-lg border-0 bg-transparent fs-2 fw-bold px-1 shadow-none"
            placeholder="在此输入文章标题..."
          />
          <div class="d-flex align-items-center gap-2 mt-2 px-1 text-muted small">
            <span class="micro-text font-monospace text-uppercase">URL Slug:</span>
            <input
              type="text"
              v-model="postForm.slug"
              class="form-control form-control-sm border-0 bg-body-tertiary px-2 py-1 font-monospace"
              placeholder="vue-3-5-deep-dive"
            />
          </div>
        </div>

        <!-- Vditor Editor Block（真实 Vditor，id="vditor"） -->
        <div class="shadow-sm mb-3 rounded overflow-hidden">
          <div id="vditor"></div>
          <div class="px-3 py-2 border-top bg-body-tertiary text-muted micro-text d-flex justify-content-end">
            字数统计: <span class="fw-bold text-main ms-1">{{ wordCount }}</span> 字
          </div>
        </div>

        <!-- Article Summary Card -->
        <div class="card p-3">
          <label class="form-label fw-bold small mb-2">文章摘要 (SEO Summary)</label>
          <textarea
            v-model="postForm.summary"
            class="form-control"
            rows="3"
            placeholder="可填写简短摘要，用于首页与搜索引擎预览..."
          ></textarea>
        </div>
      </div>

      <!-- Right Column: .form-side with THREE Cards -->
      <div class="col-lg-4 form-side">
        <!-- Card 1: 分类与发布设置 -->
        <div class="card">
          <div class="card-header py-3">
            <h3 class="card-title fw-bold fs-4 m-0">文章分类与发布</h3>
          </div>
          <div class="card-body">
            <!-- Category Select -->
            <div class="mb-3">
              <label class="form-label small fw-medium">选择分类</label>
              <select v-model="postForm.categoryId" class="form-select">
                <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                  {{ cat.name }}
                </option>
              </select>
            </div>

            <!-- Collection Select（可选：归入系列，前台 /collection/[slug] 按写作顺序展示） -->
            <div class="mb-3">
              <label class="form-label small fw-medium">合集（可选）</label>
              <select v-model="postForm.collectionId" class="form-select">
                <option :value="null">不归属任何合集</option>
                <option v-for="col in collections" :key="col.id" :value="col.id">
                  {{ col.name }}
                </option>
              </select>
              <div class="text-muted micro-text mt-1">合集可在「合集管理」页创建</div>
            </div>

            <!-- Status Selector -->
            <div>
              <label class="form-label small fw-medium">发布状态</label>
              <div class="d-flex gap-3">
                <label class="form-check cursor-pointer">
                  <input type="radio" v-model="postForm.status" value="published" class="form-check-input" />
                  <span class="form-check-label small">立即公开</span>
                </label>
                <label class="form-check cursor-pointer">
                  <input type="radio" v-model="postForm.status" value="draft" class="form-check-input" />
                  <span class="form-check-label small">草稿箱</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- Card 2: 标签 (TagPicker) -->
        <div class="card">
          <div class="card-header py-3">
            <h3 class="card-title fw-bold fs-4 m-0">文章标签</h3>
          </div>
          <div class="card-body">
            <label class="form-label small text-muted mb-2">为文章添加分类标签或多维标记</label>
            <TagPicker v-model="postForm.tags" />
          </div>
        </div>

        <!-- Card 3: 封面图 -->
        <div class="card">
          <div class="card-header py-3">
            <h3 class="card-title fw-bold fs-4 m-0">文章封面图</h3>
          </div>
          <div class="card-body">
            <div class="mb-3">
              <label class="form-label small fw-medium">图片 URL 链接</label>
              <input
                type="text"
                v-model="postForm.cover"
                class="form-control form-control-sm"
                placeholder="https://images.unsplash.com/..."
              />
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary mt-2"
                :disabled="coverUploading"
                @click="uploadCover"
              >
                {{ coverUploading ? '上传中…' : '上传封面' }}
              </button>
            </div>

            <!-- Image Preview Area -->
            <div
              v-if="postForm.cover"
              class="rounded border bg-body-tertiary overflow-hidden position-relative"
              style="height: 140px;"
            >
              <img :src="postForm.cover" class="w-100 h-100 object-fit-cover" alt="Cover Preview" />
              <button
                type="button"
                @click="postForm.cover = ''"
                class="btn btn-sm btn-danger position-absolute top-0 end-0 m-2 py-0 px-2 rounded-pill"
              >
                清除
              </button>
            </div>
            <div v-else class="text-center py-4 border border-dashed rounded text-muted small bg-body-tertiary">
              暂未设置封面，预览默认展示文字标
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
.object-fit-cover {
  object-fit: cover;
}
</style>
