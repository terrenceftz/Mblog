<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { login } from '../api/admin';

const router = useRouter();
const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);
const showPw = ref(false);

async function submit() {
  if (!username.value.trim() || !password.value) {
    error.value = '请输入用户名和密码';
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const res = await login(username.value, password.value);
    localStorage.setItem('admin_token', res.token);
    router.push('/'); // base=/admin/，内部路径 '/' → 实际 URL /admin/
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <!-- 氛围背景：深色渐变 + 琥珀/蓝紫光斑 -->
    <div class="login-bg" aria-hidden="true">
      <div class="blob b1" /><div class="blob b2" /><div class="blob b3" />
    </div>

    <div class="login-card">
      <div class="login-brand">
        <div class="login-logo" aria-hidden="true">M</div>
        <h1>MBLOG 管理后台</h1>
        <p class="login-sub">Blog Console · 内容管理</p>
      </div>

      <form class="login-form" @submit.prevent="submit">
        <label class="field">
          <span class="field-label">用户名</span>
          <input v-model="username" placeholder="请输入用户名" autocomplete="username" />
        </label>

        <label class="field">
          <span class="field-label">密码</span>
          <div class="pw-wrap">
            <input
              v-model="password"
              :type="showPw ? 'text' : 'password'"
              placeholder="请输入密码"
              autocomplete="current-password"
            />
            <button
              type="button"
              class="pw-toggle"
              :aria-label="showPw ? '隐藏密码' : '显示密码'"
              :title="showPw ? '隐藏密码' : '显示密码'"
              @click="showPw = !showPw"
            >
              <svg v-if="showPw" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
              <svg v-else width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </label>

        <p v-if="error" class="error">{{ error }}</p>

        <button type="submit" class="submit" :disabled="loading">
          {{ loading ? '登录中…' : '登 录' }}
        </button>
      </form>

      <a class="login-back" href="http://localhost:4321/">← 返回站点</a>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  position: relative;
  overflow: hidden;
  padding: var(--space-6);
}
/* 氛围光斑 */
.login-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
}
.b1 {
  width: 460px;
  height: 460px;
  left: -120px;
  top: -140px;
  background: rgba(232, 182, 76, 0.18);
}
.b2 {
  width: 420px;
  height: 420px;
  right: -100px;
  bottom: -120px;
  background: rgba(124, 156, 245, 0.16);
}
.b3 {
  width: 300px;
  height: 300px;
  left: 50%;
  top: 55%;
  transform: translate(-50%, -50%);
  background: rgba(249, 115, 22, 0.1);
}
/* 浅色主题下光斑更柔和 */
:global([data-theme='light']) .b1 { background: rgba(217, 154, 43, 0.16); }
:global([data-theme='light']) .b2 { background: rgba(79, 124, 247, 0.14); }
:global([data-theme='light']) .b3 { background: rgba(217, 154, 43, 0.08); }

.login-card {
  position: relative;
  width: 380px;
  max-width: 100%;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 36px 30px 26px;
  box-shadow: var(--shadow-pop);
  animation: card-in 0.45s ease-out;
}
@keyframes card-in {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

.login-brand {
  text-align: center;
  margin-bottom: 26px;
}
.login-logo {
  width: 52px;
  height: 52px;
  margin: 0 auto 14px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--primary), #f97316);
  color: var(--primary-contrast);
  font-size: 26px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(232, 182, 76, 0.35);
}
.login-brand h1 {
  font-size: 19px;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 4px;
}
.login-sub {
  font-size: var(--font-xs);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin: 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-label {
  font-size: var(--font-xs);
  color: var(--text-muted);
}
.field input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: var(--radius-md);
  padding: 11px 13px;
  font-size: var(--font-base);
  outline: none;
  transition: border-color var(--transition-base), box-shadow var(--transition-base);
}
.field input::placeholder {
  color: var(--text-subtle);
}
.field input:focus {
  border-color: var(--primary);
  box-shadow: var(--focus-ring);
}
.pw-wrap {
  position: relative;
}
.pw-wrap input {
  padding-right: 42px;
}
.pw-toggle {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text-subtle);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: color var(--transition-base);
}
.pw-toggle:hover {
  color: var(--primary);
}

.error {
  color: var(--danger);
  font-size: var(--font-sm);
  margin: 0;
}

.submit {
  border: none;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--primary), #f59e0b);
  color: var(--primary-contrast);
  font-size: var(--font-lg);
  font-weight: 700;
  letter-spacing: 0.2em;
  padding: var(--space-3);
  cursor: pointer;
  margin-top: 4px;
  transition: filter var(--transition-base), transform 0.1s ease, box-shadow var(--transition-base);
}
.submit:hover:not(:disabled) {
  filter: brightness(1.08);
  box-shadow: var(--shadow-sm);
}
.submit:active:not(:disabled) {
  transform: scale(0.99);
}
.submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-back {
  display: block;
  text-align: center;
  margin-top: var(--space-5);
  font-size: var(--font-sm);
  color: var(--text-subtle);
  text-decoration: none;
  transition: color var(--transition-base);
}
.login-back:hover {
  color: var(--primary);
}
</style>
