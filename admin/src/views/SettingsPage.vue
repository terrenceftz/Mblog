<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  adminGetSettings, adminPutSettings, adminSyncDouban, adminChangePassword,
} from '../api/admin';
import { toast } from '../lib/toast';

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
    toast(pwdError.value, 'error');
    return;
  }
  if (newPassword.value.length < 8) {
    pwdError.value = '新密码长度不能少于 8 位';
    toast(pwdError.value, 'error');
    return;
  }
  pwdChanging.value = true;
  try {
    const r = await adminChangePassword(oldPassword.value, newPassword.value);
    pwdMsg.value = r.message || '密码已更新';
    toast(pwdMsg.value, 'success');
    oldPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
  } catch (e) {
    pwdError.value = e instanceof Error ? e.message : '修改密码失败';
    toast(pwdError.value, 'error');
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
    toast(syncMsg.value, 'success');
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      syncError.value = '同步超时（30 秒），请稍后重试';
    } else {
      syncError.value = e instanceof Error ? e.message : '同步失败';
    }
    toast(syncError.value, 'error');
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
    for (const key of ['cos_secret_key', 'tmdb_api_key', 'turnstile_secret_key'] as const) {
      const v = payload[key];
      if (!v || v === '********') delete payload[key];
    }
    form.value = await adminPutSettings(payload);
    saved.value = true;
    toast('设置已保存', 'success');
    setTimeout(() => (saved.value = false), 2000);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败';
    toast(error.value, 'error');
  }
}
</script>

<template>
  <div>
    <h1 class="page-title">设置</h1>
    <form class="settings-form" @submit.prevent="save">
      <div class="card">
        <div class="card-title">站点信息</div>
        <div class="field-pair">
          <label>站点名称
            <input v-model="form.site_name" class="input" placeholder="我的博客" />
          </label>
          <label>默认主题
            <select v-model="form.default_theme">
              <option value="normal">正常主题</option>
              <option value="reader">极简阅读</option>
            </select>
          </label>
        </div>
        <label>站点简介
          <input v-model="form.site_description" class="input" />
        </label>
        <label>站点地址（用于 RSS）
          <input v-model="form.site_url" class="input" placeholder="https://example.com" />
        </label>
      </div>


      <div class="card">
        <div class="card-title">评论人机验证（Turnstile）</div>
        <label>Site Key
          <input v-model="form.turnstile_site_key" class="input" placeholder="在 Cloudflare → Turnstile 创建站点后获取" />
        </label>
        <label>Secret Key
          <input v-model="form.turnstile_secret_key" class="input" type="password" placeholder="留空或 **** 表示保持不变" />
        </label>
        <p class="menu-tip">配齐后评论用云验证；留空回落数学验证码。</p>
      </div>

      <div class="card">
        <div class="card-title">友链</div>
        <label>开放访客申请
          <select v-model="form.friend_link_enabled">
            <option value="1">开启</option>
            <option value="0">关闭</option>
          </select>
        </label>
      </div>

      <div class="card">
        <div class="card-title">GitHub 项目展示</div>
        <label>开启展示
          <select v-model="form.github_enabled">
            <option value="1">开启</option>
            <option value="0">关闭</option>
          </select>
        </label>
        <label>GitHub 用户名
          <input v-model="form.github_username" class="input" placeholder="octocat" />
        </label>
        <p class="menu-tip">前台 /projects 自动拉取公开仓库（不含 fork）。</p>
      </div>

      <div class="card card--full">
        <div class="card-title">导航菜单（前台顶栏）</div>
        <div class="menu-editor">
          <div v-for="(item, index) in menuItems" :key="index" class="menu-row">
            <input v-model="item.label" class="input" placeholder="菜单名称" />
            <input v-model="item.url" class="input" placeholder="链接（/归档 或 https://…）" />
            <button type="button" class="btn sm bad" @click="removeMenuRow(index)">✕</button>
          </div>
          <button type="button" class="btn sm" @click="addMenuRow">＋ 添加菜单项</button>
          <p class="menu-tip">`/` 为首页；http 开头新窗口打开；留空行忽略。</p>
        </div>
      </div>

      <div class="card">
        <div class="card-title">存储（图片/音频上传）</div>
        <label>存储方式
          <select v-model="form.storage_provider">
            <option value="local">本地磁盘</option>
            <option value="cos">腾讯云 COS</option>
          </select>
        </label>
        <template v-if="form.storage_provider === 'cos'">
          <div class="field-pair">
            <label>SecretId
              <input v-model="form.cos_secret_id" class="input" />
            </label>
            <label>SecretKey
              <input v-model="form.cos_secret_key" class="input" type="password" placeholder="留空或 **** 表示保持不变" />
            </label>
          </div>
          <div class="field-pair">
            <label>Bucket
              <input v-model="form.cos_bucket" class="input" placeholder="my-blog-1250000000" />
            </label>
            <label>Region
              <input v-model="form.cos_region" class="input" placeholder="ap-guangzhou" />
            </label>
          </div>
        </template>
      </div>

      <div class="card">
        <div class="card-title">修改密码</div>
        <label>当前密码
          <input v-model="oldPassword" class="input" type="password" autocomplete="current-password" />
        </label>
        <label>新密码（至少 8 位）
          <input v-model="newPassword" class="input" type="password" autocomplete="new-password" />
        </label>
        <label>确认新密码
          <input v-model="confirmPassword" class="input" type="password" autocomplete="new-password" />
        </label>
        <div class="sync-row">
          <button type="button" class="btn" :disabled="pwdChanging" @click="changePassword">
            {{ pwdChanging ? '提交中…' : '修改密码' }}
          </button>
          <span v-if="pwdMsg" class="saved">{{ pwdMsg }}</span>
          <span v-if="pwdError" class="error">{{ pwdError }}</span>
        </div>
      </div>

      <div class="card card--full">
        <div class="card-title">豆瓣影音展示</div>
        <div class="field-pair">
          <label>开启展示
            <select v-model="form.douban_enabled">
              <option value="1">开启</option>
              <option value="0">关闭</option>
            </select>
          </label>
          <label>豆瓣用户 ID
            <input v-model="form.douban_uid" class="input" placeholder="douban 主页 /people/ 后的数字" />
          </label>
        </div>
        <label>TMDB API Key（海报图源）
          <input v-model="form.tmdb_api_key" class="input" type="password" placeholder="留空或 **** 表示保持不变" />
        </label>
        <div class="sync-row">
          <button type="button" class="btn" :disabled="syncing" @click="syncDouban">
            {{ syncing ? '同步中…' : '立即同步豆瓣数据' }}
          </button>
          <span v-if="syncMsg" class="saved">{{ syncMsg }}</span>
          <span v-if="syncError" class="error">{{ syncError }}</span>
        </div>
        <p class="menu-tip">同步使用已保存设置——先「保存设置」再同步。拉取「看过」并预热 TMDB 海报缓存（超时 30 秒）。</p>
      </div>

      <div class="actions card--full">
        <p v-if="saved" class="saved">✓ 已保存</p>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" class="btn primary">保存设置</button>
      </div>

    </form>
  </div>
</template>

<style scoped>
.settings-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
  align-items: stretch;
  max-width: none;
}
.settings-form .card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.card--full {
  grid-column: 1 / -1;
}
.settings-form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: var(--font-sm);
  color: var(--text-muted);
}
.settings-form select {
  width: 100%;
}
.field-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}
.actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: 4px 0;
}
.saved { color: var(--ok); font-size: var(--font-base); }
.menu-editor { display: flex; flex-direction: column; gap: var(--space-2); }
.menu-row { display: flex; gap: var(--space-2); align-items: center; }
.menu-row .input { flex: 1; }
.menu-row .input:first-child { flex: 0 0 140px; }
.menu-add { align-self: flex-start; }
.menu-tip { color: var(--text-muted); font-size: var(--font-xs); margin: 0; }
.sync-row { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }

@media (max-width: 900px) {
  .settings-form {
    grid-template-columns: 1fr;
  }
  .field-pair {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
