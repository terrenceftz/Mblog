<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api/admin';
import { ApiError } from '../api/client';
import { toast } from '../lib/toast';

const router = useRouter();
const username = ref('');
const password = ref('');
const totpCode = ref('');
// 两步验证：密码正确但缺/错 TOTP 码（后端 TOTP_REQUIRED）时展开输入框
const showTotp = ref(false);
const loading = ref(false);

async function handleLogin() {
  if (!username.value || !password.value) {
    toast.warning('请输入用户名和密码');
    return;
  }
  if (showTotp.value && !/^\d{6}$/.test(totpCode.value.trim())) {
    toast.warning('请输入 6 位两步验证码');
    return;
  }

  loading.value = true;
  try {
    const success = await api.loginWithTotp(username.value, password.value, showTotp.value ? totpCode.value.trim() : undefined);
    if (success) {
      toast.success('登录成功，欢迎回来！');
      router.push('/dashboard');
    }
  } catch (err) {
    if (err instanceof ApiError && err.code === 'TOTP_REQUIRED') {
      showTotp.value = true;
      toast.info('请输入认证器中的 6 位验证码');
    } else {
      toast.error(err instanceof Error ? err.message : '登录失败');
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-blob-bg">
    <!-- Animated Light Blobs -->
    <div class="blob-1"></div>
    <div class="blob-2"></div>

    <!-- Glassmorphism Login Card -->
    <div class="login-card">
      <div class="text-center mb-4">
        <div
          class="bg-warning text-dark fw-bold rounded-3 d-inline-flex align-items-center justify-content-center shadow-lg mb-3"
          style="width: 54px; height: 54px; font-size: 1.5rem;"
        >
          M
        </div>
        <h2 class="fw-bold tracking-tight mb-1 text-white">MBLOG Admin</h2>
        <p class="text-secondary small">请输入管理员密钥登录后台系统</p>
      </div>

      <form @submit.prevent="handleLogin">
        <div class="mb-4">
          <label class="form-label text-secondary small fw-medium mb-2">用户名</label>
          <div class="input-group">
            <span class="input-group-text bg-dark border-secondary text-secondary">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </span>
            <input
              type="text"
              v-model="username"
              class="form-control bg-dark text-white border-secondary shadow-none"
              placeholder="管理员用户名"
              autocomplete="username"
            />
          </div>
        </div>

        <div class="mb-4">
          <label class="form-label text-secondary small fw-medium mb-2">访问密钥</label>
          <div class="input-group">
            <span class="input-group-text bg-dark border-secondary text-secondary">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </span>
            <input
              type="password"
              v-model="password"
              class="form-control bg-dark text-white border-secondary shadow-none"
              placeholder="密码"
              autocomplete="current-password"
            />
          </div>
        </div>

        <div v-if="showTotp" class="mb-4">
          <label class="form-label text-secondary small fw-medium mb-2">两步验证码</label>
          <div class="input-group">
            <span class="input-group-text bg-dark border-secondary text-secondary">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2-7 4 14 2-7h6"/></svg>
            </span>
            <input
              type="text"
              v-model="totpCode"
              class="form-control bg-dark text-white border-secondary shadow-none font-monospace text-center tracking-widest"
              placeholder="000000"
              maxlength="6"
              inputmode="numeric"
              autocomplete="one-time-code"
              autofocus
            />
          </div>
          <div class="text-secondary micro-text mt-1">打开认证器 App，输入当前 6 位码</div>
        </div>

        <button
          type="submit"
          class="btn btn-warning w-100 py-2.5 fw-bold text-dark shadow-lg d-flex align-items-center justify-content-center gap-2"
          :disabled="loading"
        >
          <span v-if="loading" class="spinner-border spinner-border-sm" role="status"></span>
          <span v-else>立即登录</span>
        </button>
      </form>

      <div class="mt-4 pt-3 text-center border-top border-secondary border-opacity-25 text-secondary micro-text">
        MBLOG Node + Hono + Astro Admin v3.5
      </div>
    </div>
  </div>
</template>

<style scoped>
.micro-text {
  font-size: 0.75rem;
  color: #64748b;
}
</style>
