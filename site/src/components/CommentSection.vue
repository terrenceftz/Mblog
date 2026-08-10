<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

const props = defineProps<{ postId: number }>();

interface CommentItem {
  id: number;
  author: string;
  content: string;
  createdAt: number;
  parentId: number | null;
}

const list = ref<CommentItem[]>([]);
const author = ref('');
const email = ref('');
const content = ref('');
const submitting = ref(false);
const message = ref('');
const loaded = ref(false);
const replyTo = ref<{ id: number; author: string } | null>(null);
const replyContent = ref('');

// 顶层评论 + 挂在其下的子评论（回复树，一层缩进）
const threads = computed(() => {
  const top = list.value.filter((c) => c.parentId === null);
  return top.map((c) => ({
    ...c,
    replies: list.value.filter((r) => r.parentId === c.id),
  }));
});

async function load() {
  const res = await fetch(`/api/comments?post_id=${props.postId}`);
  const body = await res.json();
  list.value = body.data;
  loaded.value = true;
}

async function submit() {
  if (!author.value.trim() || !content.value.trim()) {
    message.value = '请填写昵称和内容';
    return;
  }
  submitting.value = true;
  try {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: props.postId, author: author.value, email: email.value, content: content.value }),
    });
    const body = await res.json();
    if (!res.ok) {
      message.value = body?.error?.message ?? '提交失败';
    } else {
      message.value = '评论已提交，等待审核';
      author.value = '';
      email.value = '';
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
      body: JSON.stringify({ postId: props.postId, author: author.value || '访客', email: email.value, content: replyContent.value, parentId }),
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
        <div class="comment-head">
          <strong>{{ c.author }}</strong>
          <span class="comment-date">{{ new Date(c.createdAt).toLocaleDateString('zh-CN') }}</span>
          <button class="reply-btn" type="button" @click="replyTo = { id: c.id, author: c.author }">回复</button>
        </div>
        <p class="comment-content">{{ c.content }}</p>
        <ul v-if="c.replies.length" class="reply-list">
          <li v-for="r in c.replies" :key="r.id" class="reply-item">
            <div class="comment-head">
              <strong>{{ r.author }}</strong>
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
.comment-section { margin-top: 48px; border-top: 1px solid var(--color-border); padding-top: 24px; }
.comment-title { font-size: 18px; margin-bottom: 16px; }
.comment-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 14px; }
.comment-item { border-bottom: 1px dashed var(--color-border); padding-bottom: 12px; }
.comment-head { display: flex; gap: 12px; align-items: center; margin-bottom: 4px; }
.comment-head strong { color: var(--color-primary); }
.comment-date { color: var(--color-text-muted); font-size: 12px; }
.comment-content { margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
.reply-btn, .cancel-btn { background: none; border: none; color: var(--color-text-muted); font-size: 12px; cursor: pointer; padding: 0; }
.reply-btn:hover, .cancel-btn:hover { color: var(--color-primary); }
.reply-list { list-style: none; margin: 10px 0 0 16px; padding-left: 12px; border-left: 2px solid var(--color-border); display: flex; flex-direction: column; gap: 10px; }
.reply-item { background: var(--color-code-bg); border-radius: var(--radius); padding: 10px 12px; }
.reply-form { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
.reply-form textarea { border: 1px solid var(--color-border); border-radius: var(--radius); padding: 8px 12px; background: var(--color-surface); color: var(--color-text); resize: vertical; }
.reply-actions { display: flex; justify-content: flex-end; gap: 8px; }
.reply-actions button, .comment-form button { border: none; background: var(--color-primary); color: var(--color-primary-contrast); border-radius: var(--radius); padding: 6px 14px; cursor: pointer; }
.comment-empty { color: var(--color-text-muted); font-size: 14px; padding: 16px 0; }
.comment-form { margin-top: 20px; display: flex; flex-direction: column; gap: 10px; }
.row { display: flex; gap: 10px; }
.row.end { justify-content: flex-end; align-items: center; }
.comment-form input, .comment-form textarea {
  border: 1px solid var(--color-border); border-radius: var(--radius);
  padding: 8px 12px; background: var(--color-surface); color: var(--color-text); font-family: inherit;
}
.comment-form input { flex: 1; }
.comment-form textarea { resize: vertical; }
.comment-form button:disabled { opacity: 0.6; cursor: not-allowed; }
.comment-message { color: var(--color-text-muted); font-size: 13px; }
</style>
