<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { adminGetSettings, adminPutSettings } from '../api/admin';
import { toast } from '../lib/toast';

type ThemeKey = 'normal' | 'reader';
interface ThemeForm {
  bg: string; text: string; muted: string; primary: string; border: string;
  fontSize: number; homePageSize: number;
  avatar: string; intro: string;
}
// 与 CSS 内置默认一致的初始值（保存时全量写入，所见即所得）
const DEFAULTS: Record<ThemeKey, ThemeForm> = {
  normal: { bg: '#09090b', text: '#f4f4f5', muted: '#9d9d95', primary: '#e8b64c', border: '#26262a', fontSize: 16, homePageSize: 10, avatar: '', intro: '一个喜欢折腾代码和生活的博主' },
  reader: { bg: '#f3f0e9', text: '#3a3837', muted: '#b0aba4', primary: '#8b3525', border: '#e5e1da', fontSize: 17, homePageSize: 10, avatar: '', intro: '一个喜欢折腾代码和生活的博主' },
};

const activeTab = ref<ThemeKey>('normal');
const forms = ref<Record<ThemeKey, ThemeForm>>({ normal: { ...DEFAULTS.normal }, reader: { ...DEFAULTS.reader } });
const saved = ref(false);
const error = ref('');
const allSettings = ref<Record<string, string>>({});

function mergeStored(raw: string | undefined, d: ThemeForm): ThemeForm {
  let parsed: Record<string, unknown> = {};
  if (raw) {
    try {
      const o: unknown = JSON.parse(raw);
      if (o && typeof o === 'object' && !Array.isArray(o)) parsed = o as Record<string, unknown>;
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
    avatar: typeof parsed.avatar === 'string' ? (parsed.avatar as string) : d.avatar,
    intro: typeof parsed.intro === 'string' ? (parsed.intro as string) : d.intro,
  };
}

onMounted(async () => {
  try {
    allSettings.value = await adminGetSettings();
    forms.value.normal = mergeStored(allSettings.value.theme_normal, DEFAULTS.normal);
    forms.value.reader = mergeStored(allSettings.value.theme_reader, DEFAULTS.reader);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载主题设置失败';
  }
});

async function save() {
  saved.value = false;
  error.value = '';
  try {
    const f = forms.value[activeTab.value];
    f.fontSize = Math.min(24, Math.max(12, Math.round(f.fontSize)));
    f.homePageSize = Math.min(50, Math.max(1, Math.round(f.homePageSize)));
    allSettings.value.theme_normal = JSON.stringify(forms.value.normal);
    allSettings.value.theme_reader = JSON.stringify(forms.value.reader);
    allSettings.value = await adminPutSettings(allSettings.value);
    saved.value = true;
    toast('主题设置已保存', 'success');
    setTimeout(() => (saved.value = false), 2000);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败';
    toast(error.value, 'error');
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
      <button type="button" class="btn" :class="{ active: activeTab === 'normal' }" @click="activeTab = 'normal'">正常主题</button>
      <button type="button" class="btn" :class="{ active: activeTab === 'reader' }" @click="activeTab = 'reader'">极简阅读</button>
    </div>

    <form class="card theme-form" @submit.prevent="save">
      <div class="card-title">主题配色</div>
      <div class="color-grid">
        <label><span>背景色</span><input type="color" v-model="forms[activeTab].bg" /></label>
        <label><span>正文色</span><input type="color" v-model="forms[activeTab].text" /></label>
        <label><span>次要文字色</span><input type="color" v-model="forms[activeTab].muted" /></label>
        <label><span>主色</span><input type="color" v-model="forms[activeTab].primary" /></label>
        <label><span>边框色</span><input type="color" v-model="forms[activeTab].border" /></label>
      </div>

      <div class="num-row">
        <label>正文字号（px）
          <input class="input" type="number" v-model.number="forms[activeTab].fontSize" min="12" max="24" />
        </label>
        <label>首页文章数
          <input class="input" type="number" v-model.number="forms[activeTab].homePageSize" min="1" max="50" />
        </label>
      </div>

      <!-- 首屏内容（仅正常主题生效）：头像 + 自我介绍 -->
      <div v-if="activeTab === 'normal'" class="content-row">
        <label>首屏头像 URL
          <input class="input" v-model="forms[activeTab].avatar" placeholder="留空使用 /avatar.jpg" />
        </label>
        <label>首屏自我介绍（BlurText 逐词模糊揭示）
          <textarea class="input" v-model="forms[activeTab].intro" rows="3" placeholder="一段简短风趣的自我介绍…"></textarea>
        </label>
      </div>

      <div class="actions">
        <p v-if="saved" class="saved">✓ 已保存</p>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="button" class="btn" @click="resetTheme">重置当前主题（需保存）</button>
        <button type="submit" class="btn primary">保存主题设置</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.tabs .btn.active { background: var(--primary); border-color: var(--primary); color: var(--primary-contrast); font-weight: 600; }
.theme-form { display: flex; flex-direction: column; gap: 16px; max-width: 560px; }
.color-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; }
.color-grid label { display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 13px; color: var(--text-muted); }
.color-grid input[type='color'] { width: 100%; height: 40px; border: 1px solid var(--border); background: var(--surface); border-radius: 8px; padding: 4px; cursor: pointer; }
.num-row { display: flex; gap: 16px; }
.num-row label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-muted); }
.num-row .input { width: 140px; }
.content-row { display: flex; flex-direction: column; gap: 12px; }
.content-row label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-muted); }
.content-row textarea { resize: vertical; font-family: inherit; }
.actions { display: flex; align-items: center; gap: 12px; }
.saved { color: var(--ok); font-size: 14px; }
</style>
