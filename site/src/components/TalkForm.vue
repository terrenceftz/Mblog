<script setup lang="ts">
// 说说发布表单：提交进审核队列（蜜罐 + 后端限流）
import { ref } from 'vue';

const content = ref('');
const hp = ref('');
const submitting = ref(false);
const message = ref('');

async function submit() {
  if (!content.value.trim()) {
    message.value = '写点什么再发吧';
    return;
  }
  submitting.value = true;
  try {
    const res = await fetch('/api/talks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.value, _hp: hp.value }),
    });
    const body = await res.json();
    if (!res.ok) {
      message.value = body?.error?.message ?? '提交失败';
    } else {
      message.value = '已提交，等待审核';
      content.value = '';
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <form class="talk-form" @submit.prevent="submit">
    <textarea v-model="content" placeholder="写点什么…（说说 / 碎碎念）" maxlength="500" rows="3" />
    <input v-model="hp" class="hp-field" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" />
    <div class="talk-form-foot">
      <p v-if="message" class="talk-msg">{{ message }}</p>
      <button type="submit" :disabled="submitting">{{ submitting ? '发布中…' : '发布说说' }}</button>
    </div>
  </form>
</template>

<style scoped>
.talk-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 32px;
}
.talk-form textarea {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 12px 14px;
  background: var(--color-surface);
  color: var(--color-text);
  font-family: inherit;
  font-size: 14px;
  resize: vertical;
}
.talk-form textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}
.talk-form-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}
.talk-form button {
  border: none;
  background: var(--color-primary);
  color: var(--color-primary-contrast);
  border-radius: var(--radius);
  padding: 8px 20px;
  cursor: pointer;
  font-size: 14px;
}
.talk-form button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.talk-msg {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-muted);
}
.hp-field {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  opacity: 0;
}
</style>
