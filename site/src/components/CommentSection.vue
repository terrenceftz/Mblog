<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

const props = defineProps<{ postId: number }>();

interface CommentItem {
  id: number;
  author: string;
  website: string;
  content: string;
  createdAt: number;
  parentId: number | null;
}

const list = ref<CommentItem[]>([]);
const author = ref('');
const email = ref('');
const website = ref('');
const content = ref('');
const submitting = ref(false);
const message = ref('');
const loaded = ref(false);
const replyTo = ref<{ id: number; author: string } | null>(null);
const replyContent = ref('');

// 评论者头像色板（按名字取色，保持稳定）
const AVATAR_COLORS = ['#e8b64c', '#7c9cf5', '#f472b6', '#34d399', '#a78bfa', '#fbbf24', '#f87171', '#22d3ee'];
function avatarColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
const avatarChar = (name: string) => (name.trim().charAt(0) || '?').toUpperCase();

// 顶层评论 + 挂在其下的子评论（回复树，一层缩进）
const threads = computed(() => {
  const top = list.value.filter((c) => c.parentId === null);
  return top.map((c) => ({
    ...c,
    replies: list.value.filter((r) => r.parentId === c.id),
  }));
});

async function load() {
  try {
    const res = await fetch(`/api/comments?post_id=${props.postId}`);
    if (!res.ok) throw new Error('加载失败');
    const body = await res.json();
    list.value = body.data ?? [];
  } catch {
    list.value = [];
  } finally {
    loaded.value = true;
  }
}

function validateWebsite(): string | null {
  const w = website.value.trim();
  if (!w) return '';
  if (!/^https?:\/\/.+/i.test(w)) return '个人网站需以 http(s):// 开头';
  return null;
}

async function submit() {
  if (!author.value.trim() || !content.value.trim()) {
    message.value = '请填写昵称和内容';
    return;
  }
  const websiteErr = validateWebsite();
  if (websiteErr) {
    message.value = websiteErr;
    return;
  }
  submitting.value = true;
  try {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: props.postId, author: author.value, email: email.value, website: website.value, content: content.value }),
    });
    const body = await res.json();
    if (!res.ok) {
      message.value = body?.error?.message ?? '提交失败';
    } else {
      message.value = '评论已提交，等待审核';
      author.value = '';
      email.value = '';
      website.value = '';
      content.value = '';
    }
  } finally {
    submitting.value = false;
  }
}

async function submitReply(parentId: number) {
  if (!replyContent.value.trim()) {
    message.value = '回复内容不能为空';
    return;
  }
  submitting.value = true;
  try {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: props.postId, author: author.value || '访客', email: email.value, website: website.value, content: replyContent.value, parentId }),
    });
    const body = await res.json();
    message.value = res.ok ? '回复已提交，等待审核' : (body?.error?.message ?? '提交失败');
    if (res.ok) {
      replyTo.value = null;
      replyContent.value = '';
    }
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="comment-section">
    <h2 class="comment-title">评论</h2>

    <ul v-if="loaded && threads.length" class="comment-list">
      <li v-for="c in threads" :key="c.id" class="comment-item">
        <div class="comment-main">
          <span class="avatar" :style="{ background: avatarColor(c.author) }" aria-hidden="true">{{ avatarChar(c.author) }}</span>
          <div class="comment-body">
            <div class="comment-head">
              <a
                v-if="c.website"
                class="author author-link"
                :href="c.website"
                target="_blank"
                rel="noopener nofollow noreferrer"
              >{{ c.author }}</a>
              <span v-else class="author">{{ c.author }}</span>
              <span class="comment-date">{{ new Date(c.createdAt).toLocaleDateString('zh-CN') }}</span>
              <button class="reply-btn" type="button" @click="replyTo = { id: c.id, author: c.author }">回复</button>
            </div>
            <p class="comment-content">{{ c.content }}</p>
          </div>
        </div>

        <ul v-if="c.replies.length" class="reply-list">
          <li v-for="r in c.replies" :key="r.id" class="reply-item">
            <div class="comment-head">
              <a
                v-if="r.website"
                class="author author-link"
                :href="r.website"
                target="_blank"
                rel="noopener nofollow noreferrer"
              >{{ r.author }}</a>
              <span v-else class="author">{{ r.author }}</span>
              <span class="comment-date">{{ new Date(r.createdAt).toLocaleDateString('zh-CN') }}</span>
            </div>
            <p class="comment-content">{{ r.content }}</p>
          </li>
        </ul>

        <form v-if="replyTo?.id === c.id" class="reply-form" @submit.prevent="submitReply(c.id)">
          <textarea v-model="replyContent" :placeholder="`回复 @${replyTo.author}`" maxlength="2000" rows="2" />
          <div class="reply-actions">
            <button type="button" class="cancel-btn" @click="replyTo = null; replyContent = ''">取消</button>
            <button type="submit" :disabled="submitting">回复</button>
          </div>
        </form>
      </li>
    </ul>
    <p v-else-if="loaded" class="comment-empty">还没有评论，来抢沙发~</p>
    <p v-else class="comment-empty">评论加载中…</p>

    <form class="comment-form" @submit.prevent="submit">
      <div class="row">
        <input v-model="author" placeholder="昵称 *" maxlength="50" />
        <input v-model="email" type="email" placeholder="邮箱（不会公开）" maxlength="100" />
        <input v-model="website" type="url" placeholder="个人网站（选填）" maxlength="200" />
      </div>
      <textarea v-model="content" placeholder="说点什么… *" maxlength="2000" rows="4" />
      <div class="row end">
        <p v-if="message" class="comment-message">{{ message }}</p>
        <button type="submit" :disabled="submitting">{{ submitting ? '提交中…' : '发表评论' }}</button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.comment-section { margin-top: 48px; border-top: 1px solid var(--color-border); padding-top: 28px; }
.comment-title { font-size: 18px; font-weight: 700; margin-bottom: 20px; }
.comment-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 18px; }
.comment-item { border-bottom: 1px dashed var(--color-border); padding-bottom: 16px; }
.comment-main { display: flex; gap: 12px; }
.avatar {
  flex-shrink: 0; width: 38px; height: 38px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #09090b; font-weight: 700; font-size: 15px;
  user-select: none;
}
.comment-body { min-width: 0; flex: 1; }
.comment-head { display: flex; gap: 12px; align-items: center; margin-bottom: 5px; flex-wrap: wrap; }
.author { font-size: 14px; font-weight: 600; color: var(--color-text-heading); }
.author-link { color: var(--color-primary); text-decoration: none; }
.author-link:hover { text-decoration: underline; }
.comment-date { color: var(--color-text-muted); font-size: 12px; }
.comment-content { margin: 0; font-size: 14px; line-height: 1.65; white-space: pre-wrap; word-break: break-word; }
.reply-btn, .cancel-btn { background: none; border: none; color: var(--color-text-muted); font-size: 12px; cursor: pointer; padding: 0; }
.reply-btn:hover, .cancel-btn:hover { color: var(--color-primary); }
.reply-list { list-style: none; margin: 12px 0 0 50px; padding-left: 12px; border-left: 2px solid var(--color-border); display: flex; flex-direction: column; gap: 12px; }
.reply-item { background: var(--color-code-bg); border-radius: var(--radius); padding: 10px 14px; }
.reply-form { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.reply-form textarea { border: 1px solid var(--color-border); border-radius: var(--radius); padding: 8px 12px; background: var(--color-surface); color: var(--color-text); resize: vertical; font-family: inherit; }
.reply-actions { display: flex; justify-content: flex-end; gap: 8px; }
.reply-actions button, .comment-form button { border: none; background: var(--color-primary); color: var(--color-primary-contrast); border-radius: var(--radius); padding: 7px 16px; cursor: pointer; font-size: 14px; transition: opacity 0.2s ease; }
.reply-actions button:hover, .comment-form button:hover { opacity: 0.88; }
.comment-empty { color: var(--color-text-muted); font-size: 14px; padding: 16px 0; }
.comment-form { margin-top: 24px; display: flex; flex-direction: column; gap: 10px; }
.row { display: flex; gap: 10px; }
.row.end { justify-content: flex-end; align-items: center; }
.comment-form input, .comment-form textarea {
  border: 1px solid var(--color-border); border-radius: var(--radius);
  padding: 9px 12px; background: var(--color-surface); color: var(--color-text); font-family: inherit;
}
.comment-form input { flex: 1; }
.comment-form textarea { resize: vertical; }
.comment-form input:focus, .comment-form textarea:focus { outline: none; border-color: var(--color-primary); }
.comment-form button:disabled { opacity: 0.6; cursor: not-allowed; }
.comment-message { color: var(--color-text-muted); font-size: 13px; }
</style>
