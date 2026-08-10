<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { adminGetSettings, adminPutSettings } from '../api/admin';

const form = ref<Record<string, string>>({});
const saved = ref(false);
const error = ref('');

onMounted(async () => {
  form.value = await adminGetSettings();
});

async function save() {
  saved.value = false;
  error.value = '';
  try {
    form.value = await adminPutSettings(form.value);
    saved.value = true;
    setTimeout(() => (saved.value = false), 2000);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败';
  }
}
</script>

<template>
  <div>
    <h1 class="page-title">设置</h1>
    <form class="settings-form" @submit.prevent="save">
      <fieldset>
        <legend>站点信息</legend>
        <label>站点名称
          <input v-model="form.site_name" placeholder="我的博客" />
        </label>
        <label>站点简介
          <input v-model="form.site_description" />
        </label>
        <label>站点地址（用于 RSS）
          <input v-model="form.site_url" placeholder="https://example.com" />
        </label>
      </fieldset>

      <fieldset>
        <legend>主题</legend>
        <label>默认主题
          <select v-model="form.default_theme">
            <option value="normal">正常主题</option>
            <option value="reader">极简阅读</option>
          </select>
        </label>
      </fieldset>

      <fieldset>
        <legend>友链</legend>
        <label>开放访客申请
          <select v-model="form.friend_link_enabled">
            <option value="1">开启</option>
            <option value="0">关闭</option>
          </select>
        </label>
      </fieldset>

      <fieldset>
        <legend>存储（图片/音频上传）</legend>
        <label>存储方式
          <select v-model="form.storage_provider">
            <option value="local">本地磁盘</option>
            <option value="cos">腾讯云 COS</option>
          </select>
        </label>
        <template v-if="form.storage_provider === 'cos'">
          <label>SecretId
            <input v-model="form.cos_secret_id" />
          </label>
          <label>SecretKey
            <input v-model="form.cos_secret_key" type="password" placeholder="留空或 **** 表示保持不变" />
          </label>
          <label>Bucket
            <input v-model="form.cos_bucket" placeholder="my-blog-1250000000" />
          </label>
          <label>Region
            <input v-model="form.cos_region" placeholder="ap-guangzhou" />
          </label>
        </template>
      </fieldset>

      <div class="actions">
        <p v-if="saved" class="saved">✓ 已保存</p>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" class="btn primary">保存设置</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.page-title { font-size: 22px; margin-bottom: 20px; }
.settings-form { display: flex; flex-direction: column; gap: 16px; max-width: 560px; }
fieldset { border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
legend { font-weight: 600; font-size: 14px; padding: 0 6px; }
label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: #6b7280; }
input, select { padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px; }
.actions { display: flex; align-items: center; gap: 12px; }
.btn.primary { background: #3b82f6; color: #fff; border: none; border-radius: 8px; padding: 10px 20px; cursor: pointer; }
.saved { color: #059669; font-size: 14px; }
.error { color: #dc2626; font-size: 14px; }
</style>
