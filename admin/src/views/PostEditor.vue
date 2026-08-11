<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import {
  adminGetPost, adminCreatePost, adminUpdatePost,
  adminGetCategories, adminGetTags, uploadFile,
} from '../api/admin';
import TagPicker from '../components/TagPicker.vue';
import { toast } from '../lib/toast';

const route = useRoute();
const router = useRouter();

// 校验路由 :id：非正整数（如 /posts/abc 或 /posts/0）视为非法，跳回文章列表
const rawId = route.params.id;
const isEditRoute = rawId !== undefined;
const editId = Number(rawId ?? 0);
if (isEditRoute && (!Number.isInteger(editId) || editId <= 0)) {
  router.replace('/posts');
}

const form = ref({
  title: '',
  slug: '',
  summary: '',
  cover: '',
  categoryId: 0,
  status: 'draft' as 'draft' | 'published',
  contentMd: '',
  tagIds: [] as number[],
});
const categories = ref<Awaited<ReturnType<typeof adminGetCategories>>>([]);
const tags = ref<Awaited<ReturnType<typeof adminGetTags>>>([]);
const saving = ref(false);
const error = ref('');

// 未保存修改保护
const dirty = ref(false);
let ignoreDirtyUntil = 0;
function markDirty() {
  if (Date.now() < ignoreDirtyUntil) return;
  dirty.value = true;
}
onBeforeRouteLeave(() => {
  if (dirty.value) {
    return window.confirm('有未保存的修改，确定要离开吗？');
  }
  return true;
});

let vditor: Vditor | null = null;

// ---------- 工具栏：常用分组 + 音频插入 ----------
function buildToolbar() {
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
          const { url } = await uploadFile(file);
          vditor.insertValue(`<audio controls src="${url}"></audio>\n`, true);
        } catch {
          toast('音频上传失败', 'error');
        }
      };
      input.click();
    },
  };
  return [
    'headings', 'bold', 'italic', 'strike', '|',
    'list', 'ordered-list', 'check', 'quote', '|',
    'code', 'inline-code', 'table', '|',
    'link', 'upload', audioButton, '|',
    'undo', 'redo', '|', 'fullscreen',
  ];
}

// ---------- 封面上传 ----------
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
      const { url } = await uploadFile(file);
      form.value.cover = url;
      markDirty();
    } catch {
      toast('封面上传失败', 'error');
    } finally {
      coverUploading.value = false;
    }
  };
  input.click();
}

// ---------- 自动保存（localStorage 草稿） ----------
const DRAFT_KEY = `mblog_admin_draft_${isEditRoute ? `edit_${editId}` : 'new'}`;
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
let restoring = true;
function scheduleAutoSave() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form.value));
    } catch {
      /* 忽略存储失败 */
    }
  }, 3000);
}
watch(form, () => {
  if (!restoring) scheduleAutoSave();
}, { deep: true });
function clearAutoSave() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* 忽略 */
  }
}

onMounted(async () => {
  try {
    categories.value = await adminGetCategories();
    tags.value = await adminGetTags();

    // 恢复本地草稿（编辑页优先服务端数据）
    let draftRestored = false;
    if (!isEditRoute) {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (raw) {
          const d = JSON.parse(raw);
          if (d && typeof d === 'object' && typeof d.title === 'string') {
            form.value = { ...form.value, ...d, tagIds: Array.isArray(d.tagIds) ? d.tagIds : [] };
            draftRestored = true;
          }
        }
      } catch {
        /* 忽略 */
      }
    }

    if (isEditRoute) {
      const post = await adminGetPost(editId);
      form.value = {
        title: post.title,
        slug: post.slug,
        summary: post.summary,
        cover: post.cover,
        categoryId: post.categoryId ?? 0,
        status: post.status,
        contentMd: post.contentMd,
        tagIds: post.tags.map((t) => t.id),
      };
    }

    vditor = new Vditor('vditor', {
      height: 520,
      mode: 'wysiwyg',
      theme: 'dark',
      toolbar: buildToolbar(),
      cache: { enable: false },
      upload: {
        url: '/api/admin/upload',
        fieldName: 'file',
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token') ?? ''}` },
        filename: () => 'file',
        accept: 'image/*',
        format: (files, responseText) => {
          let url = '';
          try {
            url = (JSON.parse(responseText) as { data?: { url?: string } })?.data?.url ?? '';
          } catch {
            url = '';
          }
          const name = files[0]?.name ?? 'image';
          return JSON.stringify({
            code: 0,
            msg: '',
            data: { errFiles: [], succMap: url ? { [name]: url } : {} },
          });
        },
      },
      input: (value: string) => {
        form.value.contentMd = value;
        markDirty();
      },
      after: () => {
        if (vditor) vditor.setValue(form.value.contentMd);
        ignoreDirtyUntil = Date.now() + 300;
        dirty.value = draftRestored || isEditRoute ? dirty.value : false;
        restoring = false;
      },
    });
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败';
    restoring = false;
  }
});

async function save(status: 'draft' | 'published', navigate: boolean) {
  saving.value = true;
  error.value = '';
  const contentMd = vditor ? vditor.getValue() : form.value.contentMd;
  const payload = {
    title: form.value.title,
    slug: form.value.slug || undefined,
    contentMd,
    summary: form.value.summary,
    cover: form.value.cover,
    categoryId: form.value.categoryId || null,
    status,
    tagIds: form.value.tagIds,
  };
  try {
    if (editId) await adminUpdatePost(editId, payload);
    else await adminCreatePost(payload);
    dirty.value = false;
    clearAutoSave();
    toast(status === 'published' ? '文章已发布' : '草稿已保存', 'success');
    if (navigate) router.push('/posts');
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败';
    toast('保存失败', 'error');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <div class="editor-head">
      <h1 class="page-title">{{ editId ? '编辑文章' : '新建文章' }}</h1>
      <div class="actions">
        <button class="btn" :disabled="saving" @click="save('draft', false)">存草稿</button>
        <button v-if="editId" class="btn" :disabled="saving" @click="save('published', false)">保存</button>
        <button class="btn primary" :disabled="saving" @click="save('published', true)">{{ saving ? '保存中…' : '发布' }}</button>
      </div>
    </div>
    <p v-if="error" class="error">{{ error }}</p>

    <div class="form-grid">
      <div class="form-main">
        <div class="field">
          <input v-model="form.title" class="title-input input" placeholder="文章标题 *" maxlength="100" @input="markDirty" />
          <span class="char-count">{{ form.title.length }}/100</span>
        </div>
        <input v-model="form.slug" class="input" placeholder="slug（留空自动生成）" @input="markDirty" />
        <div class="field">
          <textarea v-model="form.summary" class="summary-input input" placeholder="摘要（留空自动截取正文）" rows="2" maxlength="300" @input="markDirty" />
          <span class="char-count">{{ form.summary.length }}/300</span>
        </div>
        <div id="vditor" />
      </div>
      <aside class="form-side">
        <div class="card">
          <div class="card-title">分类</div>
          <select v-model.number="form.categoryId" class="input" @change="markDirty">
            <option :value="0">无</option>
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div class="card">
          <div class="card-title">标签</div>
          <TagPicker v-model="form.tagIds" :tags="tags" @update:model-value="markDirty" />
        </div>
        <div class="card">
          <div class="card-title">封面图</div>
          <input v-model="form.cover" class="input" placeholder="https://… 或点击上传" @input="markDirty" />
          <button type="button" class="btn sm" style="margin-top: 8px" :disabled="coverUploading" @click="uploadCover">
            {{ coverUploading ? '上传中…' : '上传封面' }}
          </button>
          <img v-if="form.cover" :src="form.cover" alt="封面预览" class="cover-preview" />
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.editor-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.page-title { font-size: 22px; margin: 0; }
.actions { display: flex; gap: 10px; flex-wrap: wrap; }
.error { color: #f87171; margin: 0 0 12px; }
.form-grid { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 20px; align-items: start; }
.form-main { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.field { position: relative; }
.field .input { width: 100%; box-sizing: border-box; }
.title-input { font-size: 20px; font-weight: 600; }
.char-count {
  position: absolute;
  right: 10px;
  bottom: 8px;
  font-size: 11px;
  color: #5c5c66;
  pointer-events: none;
}
.form-side { display: flex; flex-direction: column; gap: 14px; }
.form-side select,
.form-side .input { width: 100%; box-sizing: border-box; }
.cover-preview {
  display: block;
  margin-top: 10px;
  max-width: 100%;
  max-height: 140px;
  border-radius: 8px;
  border: 1px solid #26262a;
  object-fit: cover;
}
/* Vditor 编辑器暗色微调（工具栏分组间距） */
:deep(.vditor) { border-color: #26262a; border-radius: 10px; }
:deep(.vditor-toolbar) { background: #101014; border-bottom-color: #26262a; }
:deep(.vditor-toolbar__item) { color: #9d9d95; }
:deep(.vditor-toolbar__item:hover), :deep(.vditor-toolbar__item--current) { color: #e8b64c; background: rgba(232,182,76,.1); }
:deep(.vditor-toolbar__divider) { background: #26262a; }
:deep(.vditor-reset) { background: #131316; color: #d4d4d8; }

@media (max-width: 900px) {
  .form-grid { grid-template-columns: 1fr; }
}
</style>
