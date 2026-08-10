<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { adminGetSettings, adminPutSettings } from '../api/admin';

type ThemeKey = 'normal' | 'reader';
interface ThemeForm {
  bg: string; text: string; muted: string; primary: string; border: string;
  fontSize: number; homePageSize: number;
}
// 与 CSS 内置默认一致的初始值（保存时全量写入，所见即所得）
const DEFAULTS: Record<ThemeKey, ThemeForm> = {
  normal: { bg: '#f5f6f8', text: '#1f2328', muted: '#6b7280', primary: '#3b82f6', border: '#e5e7eb', fontSize: 16, homePageSize: 10 },
  reader: { bg: '#f3f0e9', text: '#2e2c28', muted: '#9a968d', primary: '#5b6b7d', border: '#e7e1d5', fontSize: 17, homePageSize: 10 },
};

const activeTab = ref<ThemeKey>('normal');
const forms = ref<Record<ThemeKey, ThemeForm>>({ normal: { ...DEFAULTS.normal }, reader: { ...DEFAULTS.reader } });
const saved = ref(false);
const error = ref('');
const allSettings = ref<Record<string, string>>({});

function mergeStored(raw: string | undefined, d: ThemeForm): ThemeForm {
  let parsed: Partial<ThemeForm> = {};
  if (raw) {
    try {
      const o = JSON.parse(raw);
      if (o && typeof o === 'object') parsed = o;
    } catch { parsed = {}; }
  }
  return {
    bg: typeof parsed.bg === 'string' && parsed.bg ? parsed.bg : d.bg,
    text: typeof parsed.text === 'string' && parsed.text ? parsed.text : d.text,
    muted: typeof parsed.muted === 'string' && parsed.muted ? parsed.muted : d.muted,
    primary: typeof parsed.primary === 'string' && parsed.primary ? parsed.primary : d.primary,
    border: typeof parsed.border === 'string' && parsed.border ? parsed.border : d.border,
    fontSize: Number.isInteger(parsed.fontSize) ? (parsed.fontSize as number) : d.fontSize,
    homePageSize: Number.isInteger(parsed.homePageSize) ? (parsed.homePageSize as number) : d.homePageSize,
  };
}

onMounted(async () => {
  allSettings.value = await adminGetSettings();
  forms.value.normal = mergeStored(allSettings.value.theme_normal, DEFAULTS.normal);
  forms.value.reader = mergeStored(allSettings.value.theme_reader, DEFAULTS.reader);
});

async function save() {
  saved.value = false;
  error.value = '';
  try {
    allSettings.value.theme_normal = JSON.stringify(forms.value.normal);
    allSettings.value.theme_reader = JSON.stringify(forms.value.reader);
    allSettings.value = await adminPutSettings(allSettings.value);
    saved.value = true;
    setTimeout(() => (saved.value = false), 2000);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败';
  }
}

function resetTheme() {
  forms.value[activeTab.value] = { ...DEFAULTS[activeTab.value] };
}
</script>

<template>
  <div>
    <h1 class="page-title">主题管理</h1>
    <div class="tabs">
      <button type="button" :class="{ active: activeTab === 'normal' }" @click="activeTab = 'normal'">正常主题</button>
      <button type="button" :class="{ active: activeTab === 'reader' }" @click="activeTab = 'reader'">极简阅读</button>
    </div>

    <form class="theme-form" @submit.prevent="save">
      <div class="color-grid">
        <label><span>背景色</span><input type="color" v-model="forms[activeTab].bg" /></label>
        <label><span>正文色</span><input type="color" v-model="forms[activeTab].text" /></label>
        <label><span>次要文字色</span><input type="color" v-model="forms[activeTab].muted" /></label>
        <label><span>主色</span><input type="color" v-model="forms[activeTab].primary" /></label>
        <label><span>边框色</span><input type="color" v-model="forms[activeTab].border" /></label>
      </div>

      <div class="num-row">
        <label>正文字号（px）
          <input type="number" v-model.number="forms[activeTab].fontSize" min="12" max="24" />
        </label>
        <label>首页文章数
          <input type="number" v-model.number="forms[activeTab].homePageSize" min="1" max="50" />
        </label>
      </div>

      <div class="actions">
        <p v-if="saved" class="saved">✓ 已保存</p>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="button" class="btn" @click="resetTheme">恢复当前主题默认</button>
        <button type="submit" class="btn primary">保存主题设置</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.page-title { font-size: 22px; margin-bottom: 20px; }
.tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.tabs button {
  padding: 8px 18px; border: 1px solid #e5e7eb; background: #fff; border-radius: 8px;
  cursor: pointer; font-size: 14px; color: #374151;
}
.tabs button.active { background: #3b82f6; color: #fff; border-color: #3b82f6; }
.theme-form { display: flex; flex-direction: column; gap: 16px; max-width: 560px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; }
.color-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; }
.color-grid label { display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 13px; color: #6b7280; }
.color-grid input[type='color'] { width: 100%; height: 40px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 4px; cursor: pointer; }
.num-row { display: flex; gap: 16px; }
.num-row label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: #6b7280; }
.num-row input { padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px; width: 140px; }
.actions { display: flex; align-items: center; gap: 12px; }
.btn { background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; color: #374151; cursor: pointer; padding: 8px 16px; }
.btn.primary { background: #3b82f6; color: #fff; border: none; padding: 10px 20px; }
.saved { color: #059669; font-size: 14px; }
.error { color: #dc2626; font-size: 14px; }
</style>
