<script setup lang="ts">
import { onMounted, ref } from 'vue';

const enabled = ref(true);
const form = ref({ name: '', url: '', description: '' });
const message = ref('');
const submitting = ref(false);

onMounted(async () => {
  const res = await fetch('/api/settings/public');
  const body = await res.json();
  enabled.value = body.data.friendLinkEnabled;
});

async function submit() {
  submitting.value = true;
  message.value = '';
  try {
    const res = await fetch('/api/friend-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value),
    });
    const body = await res.json();
    if (!res.ok) message.value = body?.error?.message ?? '提交失败';
    else {
      message.value = '申请已提交，等待站长审核';
      form.value = { name: '', url: '', description: '' };
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <form v-if="enabled" class="link-form" @submit.prevent="submit">
    <h2>申请友链</h2>
    <input v-model="form.name" placeholder="站点名称 *" maxlength="50" />
    <input v-model="form.url" placeholder="站点网址（https://…） *" maxlength="300" />
    <input v-model="form.description" placeholder="一句话简介" maxlength="200" />
    <div class="row end">
      <p v-if="message" class="link-message">{{ message }}</p>
      <button type="submit" :disabled="submitting">{{ submitting ? '提交中…' : '提交申请' }}</button>
    </div>
  </form>
  <p v-else class="link-form-disabled">友链申请已关闭</p>
</template>

<style scoped>
.link-form { margin: 32px auto 0; display: flex; flex-direction: column; gap: 10px; max-width: 480px; }
.link-form h2 { font-size: 16px; margin: 0 0 4px; }
.link-form input {
  border: 1px solid var(--color-border); border-radius: var(--radius);
  padding: 8px 12px; background: var(--color-surface); color: var(--color-text);
}
.row.end { display: flex; justify-content: flex-end; align-items: center; gap: 12px; }
.link-form button {
  border: none; background: var(--color-primary); color: var(--color-primary-contrast);
  border-radius: var(--radius); padding: 8px 18px; cursor: pointer;
}
.link-form button:disabled { opacity: 0.6; }
.link-message { color: var(--color-text-muted); font-size: 13px; }
.link-form-disabled { color: var(--color-text-muted); text-align: center; padding: 24px 0; }
</style>
