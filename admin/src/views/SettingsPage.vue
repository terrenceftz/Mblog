<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api, type SiteSettings } from '../api/admin';
import { toast } from '../lib/toast';

const settings = ref<SiteSettings>({
  title: '',
  subtitle: '',
  author: '',
  avatar: '',
  apiKey: '********',
  apiSecret: '********',
  doubanUserId: '',
  doubanApiKey: '********',
  doubanSyncEnabled: true,
  lastDoubanSync: '',
  siteUrl: '',
  defaultTheme: 'normal',
  turnstileSiteKey: '',
  turnstileSecretKey: '',
  friendLinkEnabled: true,
  githubEnabled: false,
  githubUsername: '',
  navMenuNormal: '[]',
  navMenuReader: '[]',
  aboutContent: '',
  storageProvider: 'local',
  cosBucket: '',
  cosRegion: '',
  neteaseCookie: '',
  neteasePlaylistId: '',
});

const saving = ref(false);
const syncingDouban = ref(false);
const playlists = ref<{ id: number; name: string; cover: string; count: number }[]>([]);
const loadingPlaylists = ref(false);

// 网易云验证码登录
const smsPhone = ref('');
const smsCode = ref('');
const smsSending = ref(false);
const smsLogging = ref(false);

// 修改密码
const oldPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const pwdChanging = ref(false);

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

async function handleLoadPlaylists() {
  loadingPlaylists.value = true;
  try {
    const list = await api.getNeteasePlaylists();
    playlists.value = list;
    toast.success(`已加载 ${list.length} 个收藏歌单`);
  } catch (err: any) {
    toast.error(err?.message || '加载歌单失败，请先登录网易云');
  } finally {
    loadingPlaylists.value = false;
  }
}

async function handleSendSms() {
  if (!/^\d{11}$/.test(smsPhone.value)) {
    toast.warning('请输入 11 位手机号');
    return;
  }
  smsSending.value = true;
  try {
    await api.neteaseSendCode(smsPhone.value);
    toast.success('验证码已发送，请查收短信');
  } catch (err: any) {
    toast.error(err?.message || '验证码发送失败');
  } finally {
    smsSending.value = false;
  }
}

async function handleNeteaseLogin() {
  if (!/^\d{11}$/.test(smsPhone.value)) {
    toast.warning('请输入 11 位手机号');
    return;
  }
  if (!/^\d{4,6}$/.test(smsCode.value)) {
    toast.warning('请输入 4-6 位验证码');
    return;
  }
  smsLogging.value = true;
  try {
    const r = await api.neteaseLogin(smsPhone.value, smsCode.value);
    settings.value.neteaseCookie = '********';
    toast.success(r.message || '登录成功');
    smsCode.value = '';
  } catch (err: any) {
    toast.error(err?.message || '登录失败');
  } finally {
    smsLogging.value = false;
  }
}

async function handleChangePassword() {
  if (newPassword.value !== confirmPassword.value) {
    toast.warning('两次输入的新密码不一致');
    return;
  }
  if (newPassword.value.length < 8) {
    toast.warning('新密码长度不能少于 8 位');
    return;
  }
  pwdChanging.value = true;
  try {
    await api.changePassword(oldPassword.value, newPassword.value);
    toast.success('密码已更新，下次登录请使用新密码');
    oldPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '修改密码失败');
  } finally {
    pwdChanging.value = false;
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
        <div class="text-muted">配置站点信息、存储与上传、评论验证、前台功能与豆瓣同步</div>
      </div>
      <button @click="handleSaveSettings" class="btn btn-primary d-flex align-items-center gap-1 shadow-sm" :disabled="saving">
        <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
        <span>保存所有设置</span>
      </button>
    </div>

    <div class="settings-grid">
      <!-- 站点基础信息 -->
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
            <label class="form-label small fw-medium">站点简介</label>
            <textarea v-model="settings.subtitle" class="form-control" rows="2"></textarea>
          </div>
          <div class="mb-3">
            <label class="form-label small fw-medium">默认主题</label>
            <select v-model="settings.defaultTheme" class="form-select">
              <option value="normal">正常主题</option>
              <option value="reader">极简阅读</option>
            </select>
          </div>
          <div class="mb-3">
            <label class="form-label small fw-medium">站点地址（用于 RSS）</label>
            <input type="text" v-model="settings.siteUrl" class="form-control font-monospace" placeholder="https://example.com" />
          </div>
          <div class="mb-3">
            <label class="form-label small fw-medium">博主名称（前台首屏「你好，我是…」）</label>
            <input type="text" v-model="settings.author" class="form-control" />
          </div>
          <div>
            <label class="form-label small fw-medium">博主头像 URL（前台首屏头像）</label>
            <input type="text" v-model="settings.avatar" class="form-control" placeholder="留空使用默认头像" />
          </div>
          <div class="mt-3">
            <label class="form-label small fw-medium">关于我内容（前台「关于」页展示）</label>
            <textarea v-model="settings.aboutContent" class="form-control" rows="6" placeholder="写下自我介绍、经历、联系方式…（换行分段）"></textarea>
          </div>
        </div>
      </div>

      <!-- 存储与上传 -->
      <div class="card">
        <div class="card-header py-3">
          <h3 class="card-title fw-bold m-0">存储与上传（图片/音频）</h3>
        </div>
        <div class="card-body">
          <div class="mb-3">
            <label class="form-label small fw-medium">存储方式</label>
            <select v-model="settings.storageProvider" class="form-select">
              <option value="local">本地磁盘</option>
              <option value="cos">腾讯云 COS</option>
            </select>
          </div>
          <template v-if="settings.storageProvider === 'cos'">
            <div class="alert alert-info py-2 small mb-3">
              密钥展示 <code>'********'</code> 表示保持现有密钥不变，如需重置请输入新值。
            </div>
            <div class="mb-3">
              <label class="form-label small fw-medium">COS SecretId</label>
              <input type="password" v-model="settings.apiKey" class="form-control font-monospace" />
            </div>
            <div class="mb-3">
              <label class="form-label small fw-medium">COS SecretKey</label>
              <input type="password" v-model="settings.apiSecret" class="form-control font-monospace" placeholder="留空或 **** 表示保持不变" />
            </div>
            <div class="mb-3">
              <label class="form-label small fw-medium">Bucket</label>
              <input type="text" v-model="settings.cosBucket" class="form-control font-monospace" placeholder="my-blog-1250000000" />
            </div>
            <div>
              <label class="form-label small fw-medium">Region</label>
              <input type="text" v-model="settings.cosRegion" class="form-control font-monospace" placeholder="ap-guangzhou" />
            </div>
          </template>
        </div>
      </div>

      <!-- 评论人机验证（Turnstile） -->
      <div class="card">
        <div class="card-header py-3">
          <h3 class="card-title fw-bold m-0">评论人机验证（Turnstile）</h3>
        </div>
        <div class="card-body">
          <div class="alert alert-info py-2 small mb-3">
            配齐后评论用 Cloudflare 云验证；留空回落数学验证码。
          </div>
          <div class="mb-3">
            <label class="form-label small fw-medium">Site Key</label>
            <input type="text" v-model="settings.turnstileSiteKey" class="form-control font-monospace" placeholder="在 Cloudflare → Turnstile 创建站点后获取" />
          </div>
          <div>
            <label class="form-label small fw-medium">Secret Key</label>
            <input type="password" v-model="settings.turnstileSecretKey" class="form-control font-monospace" placeholder="留空或 **** 表示保持不变" />
          </div>
        </div>
      </div>

      <!-- 前台功能 -->
      <div class="card">
        <div class="card-header py-3">
          <h3 class="card-title fw-bold m-0">前台功能</h3>
        </div>
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <div class="fw-semibold small">开放友链申请</div>
              <div class="text-muted micro-text">关闭后前台不再展示友链申请入口</div>
            </div>
            <div class="form-check form-switch m-0">
              <input type="checkbox" v-model="settings.friendLinkEnabled" class="form-check-input" id="friendLinkSwitch" />
            </div>
          </div>
          <hr class="my-3" />
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <div class="fw-semibold small">GitHub 项目展示</div>
              <div class="text-muted micro-text">前台 /projects 自动拉取公开仓库（不含 fork）</div>
            </div>
            <div class="form-check form-switch m-0">
              <input type="checkbox" v-model="settings.githubEnabled" class="form-check-input" id="githubSwitch" />
            </div>
          </div>
          <div class="mt-3">
            <label class="form-label small fw-medium">GitHub 用户名</label>
            <input type="text" v-model="settings.githubUsername" class="form-control" placeholder="octocat" />
          </div>
        </div>
      </div>

      <!-- 修改密码 -->
      <div class="card">
        <div class="card-header py-3">
          <h3 class="card-title fw-bold m-0">修改密码</h3>
        </div>
        <div class="card-body">
          <div class="mb-3">
            <label class="form-label small fw-medium">当前密码</label>
            <input type="password" v-model="oldPassword" class="form-control" autocomplete="current-password" />
          </div>
          <div class="mb-3">
            <label class="form-label small fw-medium">新密码（至少 8 位）</label>
            <input type="password" v-model="newPassword" class="form-control" autocomplete="new-password" />
          </div>
          <div class="mb-3">
            <label class="form-label small fw-medium">确认新密码</label>
            <input type="password" v-model="confirmPassword" class="form-control" autocomplete="new-password" />
          </div>
          <button
            type="button"
            class="btn btn-outline-secondary d-flex align-items-center gap-1"
            :disabled="pwdChanging"
            @click="handleChangePassword"
          >
            <span v-if="pwdChanging" class="spinner-border spinner-border-sm me-1"></span>
            <span>修改密码</span>
          </button>
        </div>
      </div>

      <!-- 豆瓣影音同步 -->
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
            <label class="form-label small fw-medium">TMDB API Key（海报图源）</label>
            <input type="password" v-model="settings.doubanApiKey" class="form-control font-monospace" placeholder="留空或 **** 表示保持不变" />
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
          <div class="text-muted micro-text mt-2">同步使用已保存设置——先「保存所有设置」再同步。拉取「看过」并预热 TMDB 海报缓存（超时 30 秒）。</div>
        </div>
      </div>

      <!-- 电台（网易云音乐） -->
      <div class="card">
        <div class="card-header py-3">
          <h3 class="card-title fw-bold m-0">电台 · 网易云音乐</h3>
        </div>
        <div class="card-body">
          <div class="mb-3">
            <label class="form-label small fw-medium">网易云 Cookie（账号登录态）</label>
            <input type="password" v-model="settings.neteaseCookie" class="form-control font-monospace" placeholder="粘贴 music.163.com 登录 Cookie" />
            <div class="text-muted micro-text mt-1">
              获取方式：登录 <code>music.163.com</code> → F12 → Application → Cookies → 复制含 <code>MUSIC_U</code> 的 Cookie。
              仅用于获取你账号有权限的音乐播放源，不会下发到前台。已配置时显示 ****，留空保持不变。
            </div>
          </div>
          <div class="mb-3">
            <div class="d-flex align-items-center gap-2 mb-1">
              <span class="fw-semibold small">没有 Cookie？用短信验证码一键登录</span>
            </div>
            <div class="d-flex gap-2">
              <input type="tel" v-model="smsPhone" class="form-control" maxlength="11" placeholder="11 位手机号" />
              <button @click="handleSendSms" class="btn btn-outline-secondary text-nowrap" :disabled="smsSending">
                <span v-if="smsSending" class="spinner-border spinner-border-sm me-1"></span>
                <span>发送验证码</span>
              </button>
              <input type="text" v-model="smsCode" class="form-control" maxlength="6" placeholder="验证码" style="max-width: 130px" />
              <button @click="handleNeteaseLogin" class="btn btn-primary text-nowrap" :disabled="smsLogging">
                <span v-if="smsLogging" class="spinner-border spinner-border-sm me-1"></span>
                <span>登录</span>
              </button>
            </div>
            <div class="text-muted micro-text mt-1">验证码将发送到你绑定的手机；登录成功后自动保存 Cookie（显示 ****）。</div>
          </div>
          <div class="mb-2">
            <label class="form-label small fw-medium">当前电台歌单</label>
            <div class="d-flex gap-2">
              <select v-model="settings.neteasePlaylistId" class="form-select" :disabled="playlists.length === 0">
                <option value="">未选择</option>
                <option v-for="p in playlists" :key="p.id" :value="String(p.id)">{{ p.name }}（{{ p.count }} 首）</option>
              </select>
              <button @click="handleLoadPlaylists" class="btn btn-outline-primary text-nowrap" :disabled="loadingPlaylists">
                <span v-if="loadingPlaylists" class="spinner-border spinner-border-sm me-1"></span>
                <span>刷新收藏歌单</span>
              </button>
            </div>
            <div class="text-muted micro-text mt-1">先保存 Cookie 再「刷新收藏歌单」。修改后记得「保存所有设置」。</div>
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
