<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import {
  adminGetPost, adminCreatePost, adminUpdatePost,
  adminGetCategories, adminGetTags, uploadFile,
} from '../api/admin';

const route = useRoute();
const router = useRouter();
const editId = Number(route.params.id ?? 0);

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
  categories.value = await adminGetCategories();
  tags.value = await adminGetTags();

  if (editId) {
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
    },
    input: (value: string) => {
      form.value.contentMd = value;
    },
    after: () => {
      if (vditor) vditor.setValue(form.value.contentMd);
    },
  });
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
        <input v-model="form.title" class="title-input" placeholder="文章标题 *" />
        <input v-model="form.slug" class="slug-input" placeholder="slug（留空自动生成）" />
        <textarea v-model="form.summary" class="summary-input" placeholder="摘要（留空自动截取正文）" rows="2" />
        <div id="vditor" />
      </div>
      <aside class="form-side">
        <label>分类
          <select v-model.number="form.categoryId">
            <option :value="0">无</option>
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>
        <label>标签
          <div class="tag-check">
            <label v-for="t in tags" :key="t.id" class="tag-item">
              <input v-model="form.tagIds" type="checkbox" :value="t.id" /> {{ t.name }}
            </label>
          </div>
        </label>
        <label>封面图 URL
          <input v-model="form.cover" placeholder="https://…" />
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
