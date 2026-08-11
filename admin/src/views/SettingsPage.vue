<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  adminGetSettings, adminPutSettings, adminSyncDouban, adminChangePassword,
} from '../api/admin';

const form = ref<Record<string, string>>({});
const saved = ref(false);
const error = ref('');
const syncing = ref(false);
const syncMsg = ref('');
const syncError = ref('');

// 修改密码
const oldPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const pwdMsg = ref('');
const pwdError = ref('');
const pwdChanging = ref(false);
async function changePassword() {
  pwdMsg.value = '';
  pwdError.value = '';
  if (newPassword.value !== confirmPassword.value) {
    pwdError.value = '两次输入的新密码不一致';
    return;
  }
  if (newPassword.value.length < 8) {
    pwdError.value = '新密码长度不能少于 8 位';
    return;
  }
  pwdChanging.value = true;
  try {
    const r = await adminChangePassword(oldPassword.value, newPassword.value);
    pwdMsg.value = r.message || '密码已更新';
    oldPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
  } catch (e) {
    pwdError.value = e instanceof Error ? e.message : '修改密码失败';
  } finally {
    pwdChanging.value = false;
  }
}

async function syncDouban() {
  syncing.value = true;
  syncMsg.value = '';
  syncError.value = '';
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 30000);
  try {
    const r = await adminSyncDouban(ac.signal);
    syncMsg.value = `已同步 ${r.count} 部，缓存已预热`;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      syncError.value = '同步超时（30 秒），请稍后重试';
    } else {
      syncError.value = e instanceof Error ? e.message : '同步失败';
    }
  } finally {
    clearTimeout(timer);
    syncing.value = false;
  }
}
// 导航菜单编辑：独立数组，保存时序列化为 JSON 写入 form.nav_menu
const menuItems = ref<{ label: string; url: string }[]>([]);

onMounted(async () => {
  try {
    form.value = await adminGetSettings();
    try {
      const parsed = JSON.parse(form.value.nav_menu || '[]');
      menuItems.value = Array.isArray(parsed)
        ? parsed.filter((i: { label?: string; url?: string }) => i && typeof i.label === 'string' && typeof i.url === 'string')
        : [];
    } catch {
      menuItems.value = [];
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载设置失败';
  }
});

function addMenuRow() {
  menuItems.value.push({ label: '', url: '' });
}
function removeMenuRow(index: number) {
  menuItems.value.splice(index, 1);
}

async function save() {
  saved.value = false;
  error.value = '';
  try {
    const payload: Record<string, string> = { ...form.value };
    payload.nav_menu = JSON.stringify(
      menuItems.value.filter((i) => i.label.trim() && i.url.trim()),
    );
    // 掩码占位符 '********' 或留空 = 保持已存密钥不变（后端同样按此约定保留原值），
    // 因此保存时不把占位符/空值写回，避免覆盖真实密钥。
    for (const key of ['cos_secret_key', 'tmdb_api_key'] as const) {
      const v = payload[key];
      if (!v || v === '********') delete payload[key];
    }
    form.value = await adminPutSettings(payload);
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
        <legend>导航菜单（前台顶栏）</legend>
        <div class="menu-editor">
          <div v-for="(item, index) in menuItems" :key="index" class="menu-row">
            <input v-model="item.label" placeholder="菜单名称" />
            <input v-model="item.url" placeholder="链接（/归档 或 https://…）" />
            <button type="button" class="menu-del" @click="removeMenuRow(index)">✕</button>
          </div>
          <button type="button" class="menu-add" @click="addMenuRow">＋ 添加菜单项</button>
          <p class="menu-tip">提示：`/` 为首页；以 http 开头的链接会在新窗口打开；留空名称或链接的行会被忽略。</p>
        </div>
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

      <fieldset>
        <legend>GitHub 项目展示</legend>
        <label>开启展示
          <select v-model="form.github_enabled">
            <option value="1">开启</option>
            <option value="0">关闭</option>
          </select>
        </label>
        <label>GitHub 用户名
          <input v-model="form.github_username" placeholder="octocat" />
        </label>
        <p class="menu-tip">前台 /projects 页面将自动拉取该账号的公开仓库（不含 fork，按星数排序）。需在导航菜单中添加「项目」链接。</p>
      </fieldset>

      <fieldset>
        <legend>豆瓣影音展示</legend>
        <label>开启展示
          <select v-model="form.douban_enabled">
            <option value="1">开启</option>
            <option value="0">关闭</option>
          </select>
        </label>
        <label>豆瓣用户 ID
          <input v-model="form.douban_uid" placeholder="douban 主页 /people/ 后的数字" />
        </label>
        <label>TMDB API Key（海报图源）
          <input v-model="form.tmdb_api_key" type="password" placeholder="留空或 **** 表示保持不变" />
        </label>
        <div class="sync-row">
          <button type="button" class="btn" :disabled="syncing" @click="syncDouban">
            {{ syncing ? '同步中…' : '立即同步豆瓣数据' }}
          </button>
          <span v-if="syncMsg" class="saved">{{ syncMsg }}</span>
          <span v-if="syncError" class="error">{{ syncError }}</span>
        </div>
        <p class="menu-tip">同步会使用已保存的设置——请先点「保存设置」再同步。拉取「看过」的电影与 TMDB 海报并预热缓存，避免前台首次访问卡顿（超过 30 秒自动超时）。</p>
      </fieldset>

      <fieldset>
        <legend>修改密码</legend>
        <label>当前密码
          <input v-model="oldPassword" type="password" autocomplete="current-password" />
        </label>
        <label>新密码（至少 8 位）
          <input v-model="newPassword" type="password" autocomplete="new-password" />
        </label>
        <label>确认新密码
          <input v-model="confirmPassword" type="password" autocomplete="new-password" />
        </label>
        <div class="sync-row">
          <button type="button" class="btn" :disabled="pwdChanging" @click="changePassword">
            {{ pwdChanging ? '提交中…' : '修改密码' }}
          </button>
          <span v-if="pwdMsg" class="saved">{{ pwdMsg }}</span>
          <span v-if="pwdError" class="error">{{ pwdError }}</span>
        </div>
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
.btn { border: 1px solid #d1d5db; background: #f3f4f6; border-radius: 8px; color: #374151; padding: 8px 16px; cursor: pointer; font-size: 14px; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn.primary { background: #3b82f6; color: #fff; border: none; border-radius: 8px; padding: 10px 20px; cursor: pointer; }
.saved { color: #059669; font-size: 14px; }
.error { color: #dc2626; font-size: 14px; }
.menu-editor { display: flex; flex-direction: column; gap: 8px; }
.menu-row { display: flex; gap: 8px; align-items: center; }
.menu-row input { flex: 1; }
.menu-row input:first-child { flex: 0 0 140px; }
.menu-del { background: none; border: 1px solid #e5e7eb; border-radius: 6px; color: #dc2626; cursor: pointer; padding: 4px 8px; }
.menu-add { align-self: flex-start; background: #f3f4f6; border: 1px dashed #d1d5db; border-radius: 8px; color: #374151; cursor: pointer; padding: 6px 14px; }
.menu-add:hover { border-color: #3b82f6; color: #3b82f6; }
.menu-tip { color: #9ca3af; font-size: 12px; margin: 0; }
.sync-row { display: flex; align-items: center; gap: 12px; }
</style>
