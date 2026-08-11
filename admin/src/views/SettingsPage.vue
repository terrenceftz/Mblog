<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api, type SiteSettings } from '../api/admin';
import { toast } from '../lib/toast';

const settings = ref<SiteSettings>({
  title: '',
  subtitle: '',
  description: '',
  keywords: '',
  author: '',
  avatar: '',
  icp: '',
  apiKey: '********',
  apiSecret: '********',
  doubanUserId: '',
  doubanApiKey: '********',
  doubanSyncEnabled: true,
  lastDoubanSync: '',
});

const saving = ref(false);
const syncingDouban = ref(false);

async function loadSettings() {
  settings.value = await api.getSettings();
}

async function handleSaveSettings() {
  saving.value = true;
  try {
    const saved = await api.updateSettings(settings.value);
    settings.value = saved;
    toast.success('站点设置已成功保存！');
  } catch (err) {
    toast.error('保存设置失败');
  } finally {
    saving.value = false;
  }
}

async function handleSyncDouban() {
  syncingDouban.value = true;
  try {
    const timestamp = await api.triggerDoubanSync();
    settings.value.lastDoubanSync = timestamp;
    toast.success('豆瓣阅读数据同步成功！');
  } catch (err) {
    toast.error('同步失败，请检查豆瓣 User ID');
  } finally {
    syncingDouban.value = false;
  }
}

onMounted(() => {
  loadSettings();
});
</script>

<template>
  <div class="settings-page-view">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h2 class="page-title">站点设置</h2>
        <div class="text-muted">配置博客基本元信息、SEO 参数、系统密钥与豆瓣同步</div>
      </div>
      <button @click="handleSaveSettings" class="btn btn-primary d-flex align-items-center gap-1 shadow-sm" :disabled="saving">
        <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
        <span>保存所有设置</span>
      </button>
    </div>

    <!-- Dual Column Settings Grid (.settings-grid) -->
    <div class="settings-grid">
      <!-- Card 1: 基础信息 -->
      <div class="card">
        <div class="card-header py-3">
          <h3 class="card-title fw-bold m-0">站点基础信息</h3>
        </div>
        <div class="card-body">
          <div class="mb-3">
            <label class="form-label small fw-medium">站点名称</label>
            <input type="text" v-model="settings.title" class="form-control" />
          </div>
          <div class="mb-3">
            <label class="form-label small fw-medium">副标题</label>
            <input type="text" v-model="settings.subtitle" class="form-control" />
          </div>
          <div class="mb-3">
            <label class="form-label small fw-medium">博主名称</label>
            <input type="text" v-model="settings.author" class="form-control" />
          </div>
          <div class="mb-3">
            <label class="form-label small fw-medium">博主头像 URL</label>
            <input type="text" v-model="settings.avatar" class="form-control" />
          </div>
          <div>
            <label class="form-label small fw-medium">ICP 备案号</label>
            <input type="text" v-model="settings.icp" class="form-control font-monospace" />
          </div>
        </div>
      </div>

      <!-- Card 2: SEO 参数 -->
      <div class="card">
        <div class="card-header py-3">
          <h3 class="card-title fw-bold m-0">SEO 与搜索引擎优化</h3>
        </div>
        <div class="card-body">
          <div class="mb-3">
            <label class="form-label small fw-medium">关键词 (Meta Keywords)</label>
            <input type="text" v-model="settings.keywords" class="form-control" placeholder="用逗号分隔..." />
          </div>
          <div>
            <label class="form-label small fw-medium">站点描述 (Meta Description)</label>
            <textarea v-model="settings.description" class="form-control" rows="5"></textarea>
          </div>
        </div>
      </div>

      <!-- Card 3: 系统密钥安全配置 -->
      <div class="card">
        <div class="card-header py-3">
          <h3 class="card-title fw-bold m-0">API 密钥与安全性</h3>
        </div>
        <div class="card-body">
          <div class="alert alert-info py-2 small mb-3">
            提示：密钥项展示 <code>'********'</code> 表示保持现有密钥不变，如需重置请输入新值。
          </div>
          <div class="mb-3">
            <label class="form-label small fw-medium">系统 API Key</label>
            <input type="password" v-model="settings.apiKey" class="form-control font-monospace" />
          </div>
          <div>
            <label class="form-label small fw-medium">系统 API Secret</label>
            <input type="password" v-model="settings.apiSecret" class="form-control font-monospace" />
          </div>
        </div>
      </div>

      <!-- Card 4: 豆瓣同步配置 -->
      <div class="card">
        <div class="card-header py-3 d-flex justify-content-between align-items-center">
          <h3 class="card-title fw-bold m-0">豆瓣读书 / 影音同步</h3>
          <div class="form-check form-switch m-0">
            <input type="checkbox" v-model="settings.doubanSyncEnabled" class="form-check-input" id="doubanSwitch" />
          </div>
        </div>
        <div class="card-body">
          <div class="mb-3">
            <label class="form-label small fw-medium">豆瓣 User ID / 用户名</label>
            <input type="text" v-model="settings.doubanUserId" class="form-control" placeholder="如：terrence_reads" />
          </div>
          <div class="mb-3">
            <label class="form-label small fw-medium">豆瓣 API 密钥</label>
            <input type="password" v-model="settings.doubanApiKey" class="form-control font-monospace" />
          </div>

          <div class="p-3 bg-body-tertiary rounded-3 border d-flex align-items-center justify-content-between">
            <div>
              <div class="fw-semibold small">上次同步时间</div>
              <div class="text-muted micro-text font-monospace">{{ settings.lastDoubanSync || '从未同步' }}</div>
            </div>
            <button
              @click="handleSyncDouban"
              class="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
              :disabled="syncingDouban || !settings.doubanSyncEnabled"
            >
              <span v-if="syncingDouban" class="spinner-border spinner-border-sm me-1"></span>
              <span>立即同步</span>
            </button>
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
