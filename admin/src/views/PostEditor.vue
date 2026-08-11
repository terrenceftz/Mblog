<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import {
  adminGetPost, adminCreatePost, adminUpdatePost,
  adminGetCategories, adminGetTags, uploadFile,
} from '../api/admin';

const route = useRoute();
const router = useRouter();

// 校验路由 :id：非正整数（如 /posts/abc 或 /posts/0）视为非法，跳回文章列表，
// 避免 Number() 得到 NaN 后静默当成「新建文章」处理。
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

// 未保存修改保护：任何表单输入都会置脏，离开路由前弹窗确认。
const dirty = ref(false);
// Vditor 初始化时 setValue 可能触发 input 回调，短暂忽略以免误报「有未保存修改」。
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
        const { url } = await uploadFile(file);
        vditor.insertValue(`<audio controls src="${url}"></audio>\n`, true);
      };
      input.click();
    },
  };
  return [
    'headings', 'bold', 'italic', 'strike', 'link', '|',
    'list', 'ordered-list', 'check', 'outdent', 'indent', '|',
    'quote', 'line', 'code', 'inline-code', 'table', '|',
    'upload', audioButton, '|', 'undo', 'redo', '|', 'fullscreen',
  ];
}

onMounted(async () => {
  try {
    categories.value = await adminGetCategories();
    tags.value = await adminGetTags();

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
      height: 480,
      mode: 'wysiwyg',
      toolbar: buildToolbar(),
      cache: { enable: false },
      upload: {
        url: '/api/admin/upload',
        fieldName: 'file',
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token') ?? ''}` },
        filename: () => 'file',
        accept: 'image/*',
        // 后端返回 { data: { url, key } }；转换为 Vditor 内置契约 { code, msg, data: { errFiles, succMap } }，
        // 否则 Vditor 默认回调读不到 succMap 会抛错，导致上传后图片不插入编辑器
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
        ignoreDirtyUntil = Date.now() + 200;
        dirty.value = false;
      },
    });
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败';
  }
});

async function save(status: 'draft' | 'published') {
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
    router.push('/posts');
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败';
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
        <button class="btn" @click="save('draft')">存草稿</button>
        <button class="btn primary" :disabled="saving" @click="save('published')">{{ saving ? '保存中…' : '发布' }}</button>
      </div>
    </div>
    <p v-if="error" class="error">{{ error }}</p>

    <div class="form-grid">
      <div class="form-main">
        <input v-model="form.title" class="title-input" placeholder="文章标题 *" @input="markDirty" />
        <input v-model="form.slug" class="slug-input" placeholder="slug（留空自动生成）" @input="markDirty" />
        <textarea v-model="form.summary" class="summary-input" placeholder="摘要（留空自动截取正文）" rows="2" @input="markDirty" />
        <div id="vditor" />
      </div>
      <aside class="form-side">
        <label>分类
          <select v-model.number="form.categoryId" @change="markDirty">
            <option :value="0">无</option>
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>
        <label>标签
          <div class="tag-check">
            <label v-for="t in tags" :key="t.id" class="tag-item">
              <input v-model="form.tagIds" type="checkbox" :value="t.id" @change="markDirty" /> {{ t.name }}
            </label>
          </div>
        </label>
        <label>封面图 URL
          <input v-model="form.cover" placeholder="https://…" @input="markDirty" />
        </label>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.editor-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-title { font-size: 22px; margin: 0; }
.actions { display: flex; gap: 10px; }
.btn { border: 1px solid #e5e7eb; background: #fff; border-radius: 8px; padding: 8px 16px; cursor: pointer; }
.btn.primary { background: #3b82f6; color: #fff; border-color: #3b82f6; }
.btn:disabled { opacity: 0.6; }
.error { color: #dc2626; }
.form-grid { display: grid; grid-template-columns: 1fr 260px; gap: 20px; align-items: start; }
.form-main { display: flex; flex-direction: column; gap: 10px; }
.title-input { font-size: 20px; font-weight: 600; padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 8px; }
.slug-input, .summary-input, .form-side input, .form-side select {
  padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 8px; width: 100%; box-sizing: border-box;
}
.form-side { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
.form-side label { font-size: 13px; color: #6b7280; display: flex; flex-direction: column; gap: 6px; }
.tag-check { display: flex; flex-direction: column; gap: 6px; }
.tag-item { font-size: 14px; color: #1f2937; flex-direction: row; align-items: center; }
</style>
