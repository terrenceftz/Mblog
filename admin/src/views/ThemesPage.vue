<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api, type ThemeConfig } from '../api/admin';
import { toast } from '../lib/toast';

const themeConfig = ref<ThemeConfig>({
  layoutMode: 'normal',
  colorPalette: 'amber',
  fontSize: 16,
  postsPerPage: 10,
});

const saving = ref(false);

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
                  @click="themeConfig.colorPalette = 'amber'"
                >
                  <span class="d-inline-block rounded-circle" style="width: 24px; height: 24px; background-color: #d97706;"></span>
                  <span class="micro-text fw-medium">琥珀黄</span>
                </button>
              </div>

              <div class="col-3">
                <button
                  type="button"
                  class="btn w-100 p-2 d-flex flex-column align-items-center gap-1 border-2"
                  :class="themeConfig.colorPalette === 'blue' ? 'border-primary' : 'border-transparent'"
                  @click="themeConfig.colorPalette = 'blue'"
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
                  @click="themeConfig.colorPalette = 'emerald'"
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
                  @click="themeConfig.colorPalette = 'purple'"
                >
                  <span class="d-inline-block rounded-circle" style="width: 24px; height: 24px; background-color: #9333ea;"></span>
                  <span class="micro-text fw-medium">极光紫</span>
                </button>
              </div>
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
              :style="{ maxWidth: themeConfig.layoutMode === 'reader' ? '460px' : '100%' }"
            >
              <!-- Palette Highlight Top Border -->
              <div
                class="rounded-top position-absolute top-0 start-0 end-0"
                style="height: 4px;"
                :style="{
                  backgroundColor:
                    themeConfig.colorPalette === 'amber' ? '#d97706' :
                    themeConfig.colorPalette === 'blue' ? '#2563eb' :
                    themeConfig.colorPalette === 'emerald' ? '#059669' : '#9333ea'
                }"
              ></div>

              <div class="mb-2">
                <span
                  class="badge px-2 py-1 rounded-pill micro-text fw-medium"
                  :style="{
                    backgroundColor:
                      themeConfig.colorPalette === 'amber' ? 'rgba(217, 119, 6, 0.15)' :
                      themeConfig.colorPalette === 'blue' ? 'rgba(37, 99, 235, 0.15)' :
                      themeConfig.colorPalette === 'emerald' ? 'rgba(5, 150, 105, 0.15)' : 'rgba(147, 51, 234, 0.15)',
                    color:
                      themeConfig.colorPalette === 'amber' ? '#d97706' :
                      themeConfig.colorPalette === 'blue' ? '#2563eb' :
                      themeConfig.colorPalette === 'emerald' ? '#059669' : '#9333ea'
                  }"
                >
                  排版预览
                </span>
              </div>

              <h2 class="fw-bold tracking-tight mb-2">Vue 3.5 响应式系统深度解构</h2>
              <div class="text-muted micro-text mb-3">2026-08-11 · 阅读时间约 5 分钟</div>

              <div
                class="text-main"
                :style="{ fontSize: themeConfig.fontSize + 'px', lineHeight: '1.7' }"
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
