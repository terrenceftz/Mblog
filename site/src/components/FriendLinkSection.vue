<script setup lang="ts">
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue';

const props = withDefaults(
  defineProps<{
    siteName: string;
    siteDesc: string;
    siteUrl: string;
    avatarUrl: string;
    enabled: boolean;
  }>(),
  { siteName: '我的博客', siteDesc: '', siteUrl: '', avatarUrl: '', enabled: true },
);

// ---------- 本站信息卡（可复制字段） ----------
interface InfoField {
  label: string;
  value: string;
}
const infoFields = ref<InfoField[]>([]);
const copiedKey = ref('');

function buildFields() {
  infoFields.value = [
    { label: '站点名称', value: props.siteName },
    { label: '站点描述', value: props.siteDesc || '一个喜欢折腾代码和生活的博主' },
    { label: '站点链接', value: props.siteUrl },
    { label: '头像链接', value: props.avatarUrl },
  ];
}
buildFields();

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 非安全上下文（http）回退 execCommand
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }
}

let copiedTimer: ReturnType<typeof setTimeout> | null = null;
async function copyField(field: InfoField) {
  const ok = await copyText(field.value);
  if (!ok) return;
  copiedKey.value = field.label;
  if (copiedTimer) clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => {
    copiedKey.value = '';
  }, 1600);
}

// ---------- 申请弹窗 ----------
const open = ref(false);
const submitting = ref(false);
const message = ref('');
const messageKind = ref<'ok' | 'err'>('ok');
const form = ref({ name: '', url: '', avatar: '', rss: '', description: '' });
const firstInput = ref<HTMLInputElement | null>(null);

function openModal() {
  message.value = '';
  form.value = { name: '', url: '', avatar: '', rss: '', description: '' };
  open.value = true;
  document.documentElement.style.overflow = 'hidden';
  void nextTick(() => firstInput.value?.focus());
}
function closeModal() {
  if (submitting.value) return;
  open.value = false;
  document.documentElement.style.overflow = '';
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) closeModal();
}
onMounted(() => {
  document.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  if (copiedTimer) clearTimeout(copiedTimer);
  document.documentElement.style.overflow = '';
});

async function submit() {
  if (submitting.value) return;
  submitting.value = true;
  message.value = '';
  try {
    const res = await fetch('/api/friend-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value),
    });
    // 502/断网时 res.json() 可能抛错——给出可读提示而不是静默
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      messageKind.value = 'err';
      message.value = body?.error?.message ?? '提交失败，请稍后再试';
    } else {
      messageKind.value = 'ok';
      message.value = '申请已提交，等待站长审核';
      form.value = { name: '', url: '', avatar: '', rss: '', description: '' };
    }
  } catch {
    messageKind.value = 'err';
    message.value = '网络异常，请稍后再试';
  } finally {
    submitting.value = false;
  }
}

const steps = [
  { n: '01', title: '添加本站', desc: '将上方本站信息添加到您的友链中（点击字段右侧按钮即可复制）' },
  { n: '02', title: '提交申请', desc: '点击「申请友链」填写表单，提交您的站点信息' },
  { n: '03', title: '等待审核', desc: '站长确认信息后会尽快将您的站点加入本页' },
];
</script>

<template>
  <section class="fl-section">
    <!-- 本站信息卡 -->
    <div class="fl-head">
      <h2 class="fl-heading">本站信息<span class="fl-heading-en">Site Info</span></h2>
      <span class="fl-head-rule" aria-hidden="true" />
    </div>
    <div class="fl-info-card">
      <div class="fl-site">
        <div class="fl-site-avatar"><img :src="props.avatarUrl" :alt="props.siteName" loading="lazy" decoding="async" /></div>
        <div class="fl-site-meta">
          <span class="fl-site-name">{{ props.siteName }}</span>
          <span class="fl-site-desc">{{ props.siteDesc || '一个喜欢折腾代码和生活的博主' }}</span>
        </div>
      </div>
      <dl class="fl-fields">
        <div v-for="f in infoFields" :key="f.label" class="fl-field">
          <dt class="fl-field-label">{{ f.label }}</dt>
          <dd class="fl-field-value" :title="f.value">{{ f.value }}</dd>
          <button
            type="button"
            class="fl-copy"
            :class="{ copied: copiedKey === f.label }"
            @click="copyField(f)"
          >
            {{ copiedKey === f.label ? '已复制 ✓' : '复制' }}
          </button>
        </div>
      </dl>
    </div>

    <!-- 申请友链 -->
    <template v-if="props.enabled">
      <div class="fl-head">
        <h2 class="fl-heading">申请友链<span class="fl-heading-en">Apply</span></h2>
        <span class="fl-head-rule" aria-hidden="true" />
      </div>
      <div class="fl-apply-card">
        <ol class="fl-steps">
          <li v-for="s in steps" :key="s.n" class="fl-step">
            <span class="fl-step-n">{{ s.n }}</span>
            <div class="fl-step-body">
              <span class="fl-step-title">{{ s.title }}</span>
              <span class="fl-step-desc">{{ s.desc }}</span>
            </div>
          </li>
        </ol>
        <button type="button" class="fl-apply-btn" @click="openModal">
          申请友链
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </div>
    </template>
    <p v-else class="fl-disabled">友链申请已关闭</p>

    <!-- 申请弹窗 -->
    <Teleport to="body">
      <div v-if="open" class="fl-modal" @click.self="closeModal">
        <div class="fl-dialog" role="dialog" aria-modal="true" aria-label="申请友链">
          <div class="fl-dialog-head">
            <h3 class="fl-dialog-title">申请友链</h3>
            <button type="button" class="fl-dialog-close" aria-label="关闭" @click="closeModal">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <form class="fl-form" @submit.prevent="submit">
            <label class="fl-label">
              <span>站点名称 <em>*</em></span>
              <input ref="firstInput" v-model="form.name" placeholder="如：蜉蝣的小站" maxlength="50" required />
            </label>
            <label class="fl-label">
              <span>站点网址 <em>*</em></span>
              <input v-model="form.url" placeholder="https://example.com" maxlength="300" required />
            </label>
            <label class="fl-label">
              <span>头像链接（可选）</span>
              <input v-model="form.avatar" placeholder="https://example.com/avatar.png" maxlength="300" />
            </label>
            <label class="fl-label">
              <span>RSS 订阅地址（可选）</span>
              <input v-model="form.rss" placeholder="https://example.com/rss.xml" maxlength="300" />
            </label>
            <label class="fl-label">
              <span>一句话简介（可选）</span>
              <input v-model="form.description" placeholder="如：记录代码与生活" maxlength="200" />
            </label>
            <p v-if="message" class="fl-message" :class="messageKind">{{ message }}</p>
            <div class="fl-actions">
              <button type="button" class="fl-cancel" @click="closeModal">取消</button>
              <button type="submit" class="fl-submit" :disabled="submitting">
                {{ submitting ? '提交中…' : '提交申请' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.fl-section { max-width: var(--max-width, 1100px); margin: 56px auto 0; }

/* 区块头：中文大标题 + 英文小词 + 点线（呼应全站编辑式区块头） */
.fl-head { display: flex; align-items: baseline; gap: 12px; margin: 40px 0 18px; }
.fl-head:first-child { margin-top: 0; }
.fl-heading { font-size: clamp(1.35rem, 2.4vw, 1.7rem); font-weight: 700; letter-spacing: -0.01em; margin: 0; color: var(--color-text-heading, var(--color-text)); font-family: var(--font-display, inherit); }
.fl-heading-en { font-family: var(--font-mono, monospace); font-size: 0.72rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: var(--color-primary); margin-left: 10px; }
.fl-head-rule { flex: 1; border-bottom: 1px dotted var(--color-border, currentColor); opacity: 0.55; transform: translateY(-4px); }

/* 本站信息卡 */
.fl-info-card {
  position: relative;
  padding: 22px 24px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  overflow: hidden;
}
.fl-site { display: flex; align-items: center; gap: 14px; padding-bottom: 18px; }
.fl-site-avatar { flex-shrink: 0; width: 52px; height: 52px; border-radius: 50%; padding: 2px; background: linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 55%, transparent), color-mix(in srgb, var(--color-primary) 15%, transparent)); }
.fl-site-avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block; border: 2px solid var(--color-bg); }
.fl-site-meta { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.fl-site-name { font-family: var(--font-display, inherit); font-size: 17px; font-weight: 700; color: var(--color-text-heading, var(--color-text)); }
.fl-site-desc { font-size: 13px; color: var(--color-text-muted); line-height: 1.5; }
.fl-fields { margin: 0; padding: 4px 0 0; border-top: 1px solid var(--color-border); display: flex; flex-direction: column; }
.fl-field { display: grid; grid-template-columns: 84px minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 9px 0; border-bottom: 1px dashed var(--color-border); }
.fl-field:last-child { border-bottom: 0; }
.fl-field-label { font-family: var(--font-mono, monospace); font-size: 11px; letter-spacing: 0.08em; color: var(--color-text-muted); margin: 0; }
.fl-field-value { margin: 0; font-family: var(--font-mono, monospace); font-size: 12.5px; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fl-copy {
  border: 1px solid var(--color-border); background: transparent; color: var(--color-text-muted);
  font-family: var(--font-mono, monospace); font-size: 11px; letter-spacing: 0.05em;
  padding: 3px 12px; border-radius: 999px; cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
}
.fl-copy:hover { color: var(--color-primary); border-color: var(--color-primary); }
.fl-copy.copied { color: var(--color-primary); border-color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 8%, transparent); }
.fl-copy:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }

/* 申请卡 */
.fl-apply-card { padding: 22px 24px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; }
.fl-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
.fl-step { display: flex; gap: 14px; align-items: flex-start; }
.fl-step-n { font-family: var(--font-mono, monospace); font-size: 13px; font-weight: 600; color: var(--color-primary); line-height: 1.6; }
.fl-step-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.fl-step-title { font-size: 14px; font-weight: 600; color: var(--color-text); }
.fl-step-desc { font-size: 12.5px; line-height: 1.6; color: var(--color-text-muted); }
.fl-apply-btn {
  margin-top: 20px; display: inline-flex; align-items: center; gap: 8px;
  border: 1px solid var(--color-primary); background: var(--color-primary); color: var(--color-primary-contrast);
  font-size: 14px; font-weight: 600; padding: 10px 26px; border-radius: 999px; cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
}
.fl-apply-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 24px -10px color-mix(in srgb, var(--color-primary) 55%, transparent); }
.fl-apply-btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }
.fl-disabled { color: var(--color-text-muted); text-align: center; padding: 24px 0; font-size: 13px; }

/* 弹窗 */
.fl-modal {
  position: fixed; inset: 0; z-index: 1200;
  display: flex; align-items: center; justify-content: center; padding: 20px;
  background: color-mix(in srgb, #000 55%, transparent);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: flFadeIn 0.22s ease;
}
.fl-dialog {
  width: min(460px, 100%);
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 18px;
  padding: 20px 22px;
  animation: flPopIn 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.fl-dialog-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.fl-dialog-title { margin: 0; font-family: var(--font-display, inherit); font-size: 18px; font-weight: 700; color: var(--color-text-heading, var(--color-text)); }
.fl-dialog-close {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 50%;
  border: 1px solid var(--color-border); background: transparent; color: var(--color-text-muted); cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease;
}
.fl-dialog-close:hover { color: var(--color-primary); border-color: var(--color-primary); }
.fl-form { display: flex; flex-direction: column; gap: 12px; }
.fl-label { display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; color: var(--color-text); }
.fl-label span { font-weight: 600; letter-spacing: 0.02em; }
.fl-label em { font-style: normal; color: var(--color-primary); }
.fl-label input {
  border: 1px solid var(--color-border); border-radius: 10px;
  padding: 9px 12px; background: var(--color-bg); color: var(--color-text);
  font-size: 13.5px; font-family: var(--font-mono, monospace);
  transition: border-color 0.2s ease;
}
.fl-label input:focus { outline: none; border-color: var(--color-primary); }
.fl-message { margin: 2px 0 0; font-size: 12.5px; }
.fl-message.ok { color: var(--color-primary); }
.fl-message.err { color: var(--color-error, #d1543f); }
.fl-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }
.fl-cancel {
  border: 1px solid var(--color-border); background: transparent; color: var(--color-text-muted);
  font-size: 13px; padding: 8px 18px; border-radius: 999px; cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease;
}
.fl-cancel:hover { color: var(--color-text); border-color: var(--color-text-muted); }
.fl-submit {
  border: 1px solid var(--color-primary); background: var(--color-primary); color: var(--color-primary-contrast);
  font-size: 13px; font-weight: 600; padding: 8px 22px; border-radius: 999px; cursor: pointer;
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fl-submit:hover { transform: translateY(-1px); }
.fl-submit:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

@keyframes flFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes flPopIn { from { opacity: 0; transform: translateY(16px) scale(0.97); } to { opacity: 1; transform: none; } }

@media (prefers-reduced-motion: reduce) {
  .fl-modal, .fl-dialog, .fl-apply-btn, .fl-submit { animation: none; transition: none; }
}

/* reader 极简适配：去卡壳、细线节奏（normal 保留卡片壳） */
[data-theme='reader'] .fl-info-card,
[data-theme='reader'] .fl-apply-card {
  background: transparent;
  border: 0;
  border-top: 1px solid var(--color-border);
  border-radius: 0;
  padding: 20px 2px;
  overflow: visible;
}
[data-theme='reader'] .fl-site-avatar { padding: 0; background: none; border: 1px solid var(--color-border); }
[data-theme='reader'] .fl-site-avatar img { border: 0; }
[data-theme='reader'] .fl-site { padding-bottom: 14px; }
[data-theme='reader'] .fl-fields { border-top: 1px solid var(--color-border); }
[data-theme='reader'] .fl-copy { border-radius: 4px; }
[data-theme='reader'] .fl-apply-btn { border-radius: 4px; }
[data-theme='reader'] .fl-dialog { border-radius: 8px; }
[data-theme='reader'] .fl-label input, [data-theme='reader'] .fl-cancel, [data-theme='reader'] .fl-submit { border-radius: 4px; }

@media (max-width: 640px) {
  .fl-field { grid-template-columns: 70px minmax(0, 1fr) auto; gap: 8px; }
  .fl-steps { gap: 12px; }
  .fl-info-card, .fl-apply-card { padding: 18px 16px; }
  [data-theme='reader'] .fl-info-card, [data-theme='reader'] .fl-apply-card { padding: 16px 2px; }
}
</style>
