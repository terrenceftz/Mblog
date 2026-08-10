<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { login } from '../api/admin';

const router = useRouter();
const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  loading.value = true;
  error.value = '';
  try {
    const res = await login(username.value, password.value);
    localStorage.setItem('admin_token', res.token);
    router.push('/admin/');
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <form class="login-card" @submit.prevent="submit">
      <h1>MBLOG 管理后台</h1>
      <input v-model="username" placeholder="用户名" autocomplete="username" />
      <input v-model="password" type="password" placeholder="密码" autocomplete="current-password" />
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="loading">{{ loading ? '登录中…' : '登录' }}</button>
    </form>
  </div>
</template>

<style scoped>
.login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f5f6f8; }
.login-card { width: 320px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); padding: 32px 24px; display: flex; flex-direction: column; gap: 12px; }
.login-card h1 { font-size: 20px; margin: 0 0 8px; text-align: center; }
.login-card input { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; }
.login-card button { border: none; background: #3b82f6; color: #fff; border-radius: 8px; padding: 10px; cursor: pointer; font-size: 15px; }
.login-card button:disabled { opacity: 0.6; }
.error { color: #dc2626; font-size: 13px; margin: 0; }
</style>
