<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api, type Talk } from '../api/admin';
import { toast } from '../lib/toast';

const talks = ref<Talk[]>([]);
const newTalkContent = ref('');
const loading = ref(false);
const maxCharLimit = 500;

const charCount = computed(() => newTalkContent.value.length);
const isNearLimit = computed(() => charCount.value >= 450 && charCount.value < 500);
const isOverLimit = computed(() => charCount.value >= 500);

async function loadTalks() {
  loading.value = true;
  talks.value = await api.getTalks();
  loading.value = false;
}

async function handlePublishTalk() {
  const content = newTalkContent.value.trim();
  if (!content) {
    toast.warning('请输入说说内容');
    return;
  }
  if (charCount.value > maxCharLimit) {
    toast.error(`已超过 ${maxCharLimit} 字限制，请删减字数后再试`);
    return;
  }

  await api.createTalk(content);
  toast.success('说说发布成功！');
  newTalkContent.value = '';
  loadTalks();
}

async function handleUpdateStatus(id: number, status: Talk['status']) {
  await api.updateTalkStatus(id, status);
  toast.success(status === 'approved' ? '已审核通过' : '已拒绝');
  loadTalks();
}

async function handleDelete(id: number) {
  if (confirm('确定要删除这条说说吗？')) {
    await api.deleteTalk(id);
    toast.success('说说已删除');
    loadTalks();
  }
}

onMounted(() => {
  loadTalks();
});
</script>

<template>
  <div class="talk-manager-view">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h2 class="page-title">微语 / 说说管理</h2>
        <div class="text-muted">随时记录短随笔与生活闪光点，限 500 字</div>
      </div>
    </div>

    <!-- Publish Box Card with Character Counter (450/500 threshold) -->
    <div class="card mb-4">
      <div class="card-body">
        <h3 class="card-title fw-bold mb-3">发布新说说</h3>
        <div class="mb-3">
          <textarea
            v-model="newTalkContent"
            class="form-control"
            rows="4"
            placeholder="此刻有什么新鲜事或感悟？..."
            style="resize: vertical;"
          ></textarea>
        </div>

        <div class="d-flex align-items-center justify-content-between">
          <!-- Dynamic Character Count Indicator -->
          <div
            class="small font-monospace transition-all"
            :class="{
              'text-muted': !isNearLimit && !isOverLimit,
              'text-warning fw-bold': isNearLimit,
              'text-danger fw-bold fs-3': isOverLimit,
            }"
          >
            字数统计: {{ charCount }} / {{ maxCharLimit }}
            <span v-if="isNearLimit" class="ms-2 micro-text">(即将达到上限)</span>
            <span v-if="isOverLimit" class="ms-2 micro-text">(已超出最大限制)</span>
          </div>

          <button
            @click="handlePublishTalk"
            class="btn btn-primary d-flex align-items-center gap-1 shadow-sm"
            :disabled="isOverLimit || !newTalkContent.trim()"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            <span>立即发布</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Talks Timeline / List -->
    <div class="card">
      <div class="card-header py-3">
        <h3 class="card-title fw-bold m-0">说说列表 (共 {{ talks.length }} 条)</h3>
      </div>

      <div class="card-body p-0">
        <div v-if="talks.length === 0" class="text-center text-muted py-5">
          暂无说说记录
        </div>

        <div class="list-group list-group-flush">
          <div v-for="t in talks" :key="t.id" class="list-group-item p-4">
            <div class="d-flex align-items-start justify-content-between gap-3">
              <div class="flex-grow-1">
                <div class="d-flex align-items-center gap-2 mb-2">
                  <span v-if="t.status === 'approved'" class="badge badge-soft-success">已公开</span>
                  <span v-else-if="t.status === 'pending'" class="badge badge-soft-warning">待审核</span>
                  <span v-else class="badge badge-soft-danger">已拒绝</span>

                  <span class="text-muted micro-text font-monospace">{{ t.created_at }}</span>
                  <span class="badge badge-soft-secondary micro-text">❤️ {{ t.likeCount }} 赞</span>
                </div>

                <div class="fs-4 text-main mb-2" style="white-space: pre-wrap; line-height: 1.6;">
                  {{ t.content }}
                </div>
              </div>

              <div class="btn-list flex-nowrap align-items-start">
                <button
                  v-if="t.status !== 'approved'"
                  @click="handleUpdateStatus(t.id, 'approved')"
                  class="btn btn-sm btn-outline-success"
                >
                  通过
                </button>
                <button
                  v-if="t.status !== 'rejected'"
                  @click="handleUpdateStatus(t.id, 'rejected')"
                  class="btn btn-sm btn-outline-warning"
                >
                  拒绝
                </button>
                <button @click="handleDelete(t.id)" class="btn btn-sm btn-ghost-danger">
                  删除
                </button>
              </div>
            </div>
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
