<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api, type ThemeConfig } from '../api/admin';
import { toast } from '../lib/toast';

const themeConfig = ref<ThemeConfig>({
  layoutMode: 'normal',
  colorPalette: 'amber',
  fontSize: 16,
  postsPerPage: 10,
  colors: {
    normal: {
      bg: '#09090b', text: '#f4f4f5', muted: '#9d9d95', primary: '#e8b64c',
      border: '#26262a', avatar: '', intro: '一个喜欢折腾代码和生活的博主'
    },
    reader: {
      bg: '#f3f0e9', text: '#3a3837', muted: '#b0aba4', primary: '#8b3525',
      border: '#e5e1da', avatar: '', intro: '一个喜欢折腾代码和生活的博主'
    }
  }
});

const saving = ref(false);

/** 当前编辑的主题（随 layoutMode 切换） */
const currentColors = () =>
  themeConfig.value.colors[themeConfig.value.layoutMode === 'reader' ? 'reader' : 'normal'];

/** 色板预设：选择时联动写入当前主题的主色 */
const PALETTES: Record<ThemeConfig['colorPalette'], { primary: string; bg: string }> = {
  amber: { primary: '#e8b64c', bg: '#09090b' },
  blue: { primary: '#2563eb', bg: '#0b1220' },
  emerald: { primary: '#059669', bg: '#081410' },
  purple: { primary: '#9333ea', bg: '#120b1e' },
};

function pickPalette(p: ThemeConfig['colorPalette']) {
  themeConfig.value.colorPalette = p;
  const preset = PALETTES[p];
  const colors = currentColors();
  colors.primary = preset.primary;
  if (themeConfig.value.layoutMode === 'normal') colors.bg = preset.bg;
}

async function loadConfig() {
  themeConfig.value = await api.getThemeConfig();
}

async function handleSaveTheme() {
  saving.value = true;
  try {
    const updated = await api.updateThemeConfig(themeConfig.value);
    themeConfig.value = updated;
    toast.success('前台主题与阅读配置已更新');
  } catch (err) {
    toast.error('保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  loadConfig();
});
</script>

<template>
  <div class="themes-page-view">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h2 class="page-title">前台视觉与阅读模式配置</h2>
        <div class="text-muted">定制 Astro 前台的排版样式、色板强调色与阅读器沉浸模式</div>
      </div>
      <button @click="handleSaveTheme" class="btn btn-primary d-flex align-items-center gap-1 shadow-sm" :disabled="saving">
        <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
        <span>应用主题设置</span>
      </button>
    </div>

    <div class="row g-4">
      <!-- Left Column: Controls -->
      <div class="col-lg-6">
        <!-- Layout Mode Card -->
        <div class="card mb-4">
          <div class="card-header py-3">
            <h3 class="card-title fw-bold m-0">布局模式选择 (Normal / Reader)</h3>
          </div>
          <div class="card-body">
            <div class="row g-3">
              <div class="col-6">
                <label
                  class="card p-3 cursor-pointer text-center border-2 transition-all"
                  :class="themeConfig.layoutMode === 'normal' ? 'border-primary bg-primary-subtle' : 'border-color'"
                >
                  <input type="radio" v-model="themeConfig.layoutMode" value="normal" class="d-none" />
                  <div class="fw-bold fs-3 mb-1 text-main">经典模式</div>
                  <div class="text-muted micro-text">包含侧边栏、分类导航与完整 Footer</div>
                </label>
              </div>

              <div class="col-6">
                <label
                  class="card p-3 cursor-pointer text-center border-2 transition-all"
                  :class="themeConfig.layoutMode === 'reader' ? 'border-primary bg-primary-subtle' : 'border-color'"
                >
                  <input type="radio" v-model="themeConfig.layoutMode" value="reader" class="d-none" />
                  <div class="fw-bold fs-3 mb-1 text-main">极简专注模式</div>
                  <div class="text-muted micro-text">单栏无干扰排版，提升长文沉浸感</div>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- Palette Selector Card -->
        <div class="card mb-4">
          <div class="card-header py-3">
            <h3 class="card-title fw-bold m-0">配色方案 (Color Palette)</h3>
          </div>
          <div class="card-body">
            <div class="row g-2">
              <div class="col-3">
                <button
                  type="button"
                  class="btn w-100 p-2 d-flex flex-column align-items-center gap-1 border-2"
                  :class="themeConfig.colorPalette === 'amber' ? 'border-warning' : 'border-transparent'"
                  @click="pickPalette('amber')"
                >
                  <span class="d-inline-block rounded-circle" style="width: 24px; height: 24px; background-color: #e8b64c;"></span>
                  <span class="micro-text fw-medium">琥珀黄</span>
                </button>
              </div>

              <div class="col-3">
                <button
                  type="button"
                  class="btn w-100 p-2 d-flex flex-column align-items-center gap-1 border-2"
                  :class="themeConfig.colorPalette === 'blue' ? 'border-primary' : 'border-transparent'"
                  @click="pickPalette('blue')"
                >
                  <span class="d-inline-block rounded-circle" style="width: 24px; height: 24px; background-color: #2563eb;"></span>
                  <span class="micro-text fw-medium">海洋蓝</span>
                </button>
              </div>

              <div class="col-3">
                <button
                  type="button"
                  class="btn w-100 p-2 d-flex flex-column align-items-center gap-1 border-2"
                  :class="themeConfig.colorPalette === 'emerald' ? 'border-success' : 'border-transparent'"
                  @click="pickPalette('emerald')"
                >
                  <span class="d-inline-block rounded-circle" style="width: 24px; height: 24px; background-color: #059669;"></span>
                  <span class="micro-text fw-medium">翡翠绿</span>
                </button>
              </div>

              <div class="col-3">
                <button
                  type="button"
                  class="btn w-100 p-2 d-flex flex-column align-items-center gap-1 border-2"
                  :class="themeConfig.colorPalette === 'purple' ? 'border-info' : 'border-transparent'"
                  @click="pickPalette('purple')"
                >
                  <span class="d-inline-block rounded-circle" style="width: 24px; height: 24px; background-color: #9333ea;"></span>
                  <span class="micro-text fw-medium">极光紫</span>
                </button>
              </div>
            </div>
            <div class="text-muted micro-text mt-2">选择色板会联动写入当前布局模式的主色，仍可在下方配色细节中微调。</div>
          </div>
        </div>

        <!-- Color Details Card（配色细节，normal/reader 各自维护） -->
        <div class="card mb-4">
          <div class="card-header py-3">
            <h3 class="card-title fw-bold m-0">配色细节（{{ themeConfig.layoutMode === 'normal' ? '经典模式' : '极简阅读' }}）</h3>
          </div>
          <div class="card-body">
            <div class="row g-3">
              <div class="col-6" v-for="field in (['bg', 'text', 'muted', 'primary', 'border'] as const)" :key="field">
                <label class="form-label small fw-medium d-flex justify-content-between">
                  <span>{{ { bg: '背景色', text: '正文色', muted: '次要文字色', primary: '主色', border: '边框色' }[field] }}</span>
                  <span class="font-monospace text-muted">{{ currentColors()[field] }}</span>
                </label>
                <input type="color" v-model="currentColors()[field]" class="form-control form-control-color w-100" style="height: 38px;" />
              </div>
            </div>
          </div>
        </div>

        <!-- Hero Content Card（仅 normal 主题生效） -->
        <div class="card mb-4" v-if="themeConfig.layoutMode === 'normal'">
          <div class="card-header py-3">
            <h3 class="card-title fw-bold m-0">首屏内容（仅经典模式生效）</h3>
          </div>
          <div class="card-body">
            <div class="alert alert-info py-2 small mb-3">
              首屏头像与博主名称统一在「站点设置 → 站点基础信息」中配置（博主头像 URL / 博主名称），此处无需重复设置。
            </div>
            <div>
              <label class="form-label small fw-medium">首屏自我介绍（BlurText 逐词模糊揭示）</label>
              <textarea v-model="currentColors().intro" class="form-control" rows="3" placeholder="一段简短风趣的自我介绍…"></textarea>
            </div>
          </div>
        </div>

        <!-- Font Size & Page Count Card -->
        <div class="card">
          <div class="card-header py-3">
            <h3 class="card-title fw-bold m-0">正文字号与分页数</h3>
          </div>
          <div class="card-body">
            <div class="mb-4">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <label class="form-label small fw-medium m-0">默认正文字号</label>
                <span class="badge bg-primary font-monospace">{{ themeConfig.fontSize }}px</span>
              </div>
              <input type="range" min="14" max="22" v-model.number="themeConfig.fontSize" class="form-range" />
            </div>

            <div>
              <div class="d-flex justify-content-between align-items-center mb-2">
                <label class="form-label small fw-medium m-0">首页每页显示文章数量</label>
                <span class="badge bg-primary font-monospace">{{ themeConfig.postsPerPage }} 篇</span>
              </div>
              <input type="range" min="5" max="30" step="5" v-model.number="themeConfig.postsPerPage" class="form-range" />
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Live Reader Preview Card -->
      <div class="col-lg-6">
        <div class="card h-100">
          <div class="card-header py-3">
            <h3 class="card-title fw-bold m-0">前台排版效果实时预览</h3>
          </div>
          <div class="card-body p-4 bg-body-tertiary">
            <div
              class="card p-4 mx-auto shadow-sm transition-all"
              :style="{
                maxWidth: themeConfig.layoutMode === 'reader' ? '460px' : '100%',
                backgroundColor: currentColors().bg,
                borderColor: currentColors().border,
              }"
            >
              <!-- Palette Highlight Top Border -->
              <div
                class="rounded-top position-absolute top-0 start-0 end-0"
                style="height: 4px;"
                :style="{ backgroundColor: currentColors().primary }"
              ></div>

              <div class="mb-2">
                <span
                  class="badge px-2 py-1 rounded-pill micro-text fw-medium"
                  :style="{
                    backgroundColor: currentColors().primary + '26',
                    color: currentColors().primary,
                  }"
                >
                  排版预览
                </span>
              </div>

              <h2 class="fw-bold tracking-tight mb-2" :style="{ color: currentColors().text }">Vue 3.5 响应式系统深度解构</h2>
              <div class="micro-text mb-3" :style="{ color: currentColors().muted }">2026-08-11 · 阅读时间约 5 分钟</div>

              <div
                :style="{ fontSize: themeConfig.fontSize + 'px', lineHeight: '1.7', color: currentColors().text }"
              >
                Vue 3.5 带来了全新的响应式引擎优化，内存占用大幅降低。克制的设计与清晰的层级是 Web 体验的核心，字号为 {{ themeConfig.fontSize }}px 时具备最佳的可读性。
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
.cursor-pointer {
  cursor: pointer;
}
</style>
