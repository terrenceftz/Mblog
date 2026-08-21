<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api, type Comment } from '../api/admin';
import { toast } from '../lib/toast';

const comments = ref<Comment[]>([]);
const activeStatus = ref<string>('all');
const selectedIds = ref<number[]>([]);
const currentPage = ref(1);
const pageSize = 5;

// Reply Modal State
const replyingComment = ref<Comment | null>(null);
const replyText = ref('');

async function loadComments() {
  comments.value = await api.getComments(activeStatus.value);
  selectedIds.value = [];
}

const filteredComments = computed(() => {
  if (activeStatus.value === 'all') return comments.value;
  return comments.value.filter((c) => c.status === activeStatus.value);
});

const totalPages = computed(() => Math.ceil(filteredComments.value.length / pageSize) || 1);

const paginatedComments = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredComments.value.slice(start, start + pageSize);
});

const isAllSelected = computed(() => {
  if (paginatedComments.value.length === 0) return false;
  return paginatedComments.value.every((c) => selectedIds.value.includes(c.id));
});

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedIds.value = [];
  } else {
    selectedIds.value = paginatedComments.value.map((c) => c.id);
  }
}

function toggleSelect(id: number) {
  const idx = selectedIds.value.indexOf(id);
  if (idx !== -1) {
    selectedIds.value.splice(idx, 1);
  } else {
    selectedIds.value.push(id);
  }
}

async function handleBatch(action: 'approve' | 'reject' | 'delete') {
  if (selectedIds.value.length === 0) {
    toast.warning('请先勾选需要处理的评论');
    return;
  }

  const actionText = action === 'approve' ? '通过' : action === 'reject' ? '拒绝' : '删除';
  if (confirm(`确定要对选中的 ${selectedIds.value.length} 条评论进行【${actionText}】操作吗？`)) {
    await api.batchUpdateComments(selectedIds.value, action);
    toast.success(`已对 ${selectedIds.value.length} 条评论执行${actionText}`);
    loadComments();
  }
}

async function handleUpdateStatus(id: number, status: Comment['status']) {
  await api.updateCommentStatus(id, status);
  toast.success('评论状态已更新');
  loadComments();
}

function openReplyModal(comment: Comment) {
  replyingComment.value = comment;
  replyText.value = comment.replyContent || '';
}

async function saveReply() {
  if (!replyingComment.value) return;
  if (!replyText.value.trim()) {
    toast.warning('回复内容不能为空');
    return;
  }
  await api.updateCommentStatus(replyingComment.value.id, 'approved', replyText.value.trim());
  toast.success('已回复评论');
  replyingComment.value = null;
  replyText.value = '';
  loadComments();
}

onMounted(() => {
  loadComments();
});
</script>

<template>
  <div class="comment-manager-view">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h2 class="page-title">评论管理</h2>
        <div class="text-muted">审核与回复读者留言，支持高效批量处理</div>
      </div>

      <!-- Batch Action Toolbar -->
      <div v-if="selectedIds.length > 0" class="d-flex align-items-center gap-2 bg-body-tertiary p-2 rounded-3 border">
        <span class="small text-muted me-1">已选 <strong>{{ selectedIds.length }}</strong> 项</span>
        <button @click="handleBatch('approve')" class="btn btn-sm btn-success">批量通过</button>
        <button @click="handleBatch('reject')" class="btn btn-sm btn-warning">批量拒绝</button>
        <button @click="handleBatch('delete')" class="btn btn-sm btn-danger">批量删除</button>
      </div>
    </div>

    <!-- Status Filter Tabs -->
    <div class="card mb-4">
      <div class="card-header p-2">
        <ul class="nav nav-pills card-header-pills">
          <li class="nav-item">
            <button
              class="nav-link px-3 py-1.5 small rounded-2"
              :class="{ active: activeStatus === 'all' }"
              @click="activeStatus = 'all'; loadComments()"
            >
              全部评论
            </button>
          </li>
          <li class="nav-item">
            <button
              class="nav-link px-3 py-1.5 small rounded-2"
              :class="{ active: activeStatus === 'pending' }"
              @click="activeStatus = 'pending'; loadComments()"
            >
              待审核
            </button>
          </li>
          <li class="nav-item">
            <button
              class="nav-link px-3 py-1.5 small rounded-2"
              :class="{ active: activeStatus === 'approved' }"
              @click="activeStatus = 'approved'; loadComments()"
            >
              已通过
            </button>
          </li>
        </ul>
      </div>
    </div>

    <!-- Comment List Table -->
    <div class="card">
      <div class="table-responsive">
        <table class="table table-vcenter card-table table-hover">
          <thead>
            <tr>
              <th style="width: 40px" class="text-center">
                <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" class="form-check-input" />
              </th>
              <th>评论者 / 文章</th>
              <th>评论内容</th>
              <th>状态</th>
              <th>时间 / IP</th>
              <th class="text-end">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="paginatedComments.length === 0">
              <td colspan="6" class="text-center text-muted py-5">
                暂无此分类下的评论
              </td>
            </tr>

            <tr v-for="c in paginatedComments" :key="c.id">
              <td class="text-center">
                <input
                  type="checkbox"
                  :checked="selectedIds.includes(c.id)"
                  @change="toggleSelect(c.id)"
                  class="form-check-input"
                />
              </td>

              <td>
                <div class="d-flex align-items-center gap-2">
                  <img :src="c.avatar" class="avatar avatar-sm rounded-circle flex-shrink-0" alt="avatar" />
                  <div class="min-w-0">
                    <div class="fw-bold text-main small text-truncate">{{ c.author }}</div>
                    <div class="text-muted micro-text text-truncate">《{{ c.postTitle }}》</div>
                  </div>
                </div>
              </td>

              <td>
                <div class="text-main small mb-1" style="max-width: 380px;">{{ c.content }}</div>
              </td>

              <td>
                <span v-if="c.status === 'approved'" class="badge badge-soft-success">已通过</span>
                <span v-else-if="c.status === 'pending'" class="badge badge-soft-warning">待审核</span>
                <span v-else class="badge badge-soft-secondary">已拒绝</span>
              </td>

              <td class="small text-muted">
                <div>{{ c.created_at.substring(0, 10) }}</div>
                <div class="micro-text font-monospace">{{ c.ip }}</div>
              </td>

              <td class="text-end">
                <div class="btn-list flex-nowrap justify-content-end">
                  <button @click="openReplyModal(c)" class="btn btn-sm btn-ghost-primary" title="回复评论">
                    回复
                  </button>
                  <button v-if="c.status !== 'approved'" @click="handleUpdateStatus(c.id, 'approved')" class="btn btn-sm btn-ghost-success" title="通过">
                    通过
                  </button>
                  <button v-if="c.status !== 'rejected'" @click="handleUpdateStatus(c.id, 'rejected')" class="btn btn-sm btn-ghost-warning" title="拒绝">
                    拒绝
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer -->
      <div class="card-footer d-flex align-items-center justify-content-between py-3">
        <div class="text-muted small">
          共 {{ filteredComments.length }} 条留言
        </div>

        <ul class="pagination m-0">
          <li class="page-item" :class="{ disabled: currentPage === 1 }">
            <button class="page-item-btn" @click="currentPage--" :disabled="currentPage === 1">上一页</button>
          </li>
          <li v-for="page in totalPages" :key="page" class="page-item" :class="{ active: currentPage === page }">
            <button class="page-item-btn" @click="currentPage = page">{{ page }}</button>
          </li>
          <li class="page-item" :class="{ disabled: currentPage === totalPages }">
            <button class="page-item-btn" @click="currentPage++" :disabled="currentPage === totalPages">下一页</button>
          </li>
        </ul>
      </div>
    </div>

    <!-- Reply Modal Drawer -->
    <div v-if="replyingComment" class="modal fade show d-block bg-dark bg-opacity-50" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content card">
          <div class="modal-header border-bottom py-3">
            <h5 class="modal-title fw-bold">回复 {{ replyingComment.author }} 的评论</h5>
            <button type="button" class="btn-close" @click="replyingComment = null"></button>
          </div>
          <div class="modal-body p-4">
            <div class="p-3 bg-body-tertiary rounded mb-3 small text-muted">
              "{{ replyingComment.content }}"
            </div>
            <label class="form-label fw-bold small">回复内容</label>
            <textarea
              v-model="replyText"
              class="form-control"
              rows="4"
              placeholder="在此输入您的公开回复..."
            ></textarea>
          </div>
          <div class="modal-footer border-top">
            <button type="button" class="btn btn-secondary" @click="replyingComment = null">取消</button>
            <button type="button" class="btn btn-primary" @click="saveReply">提交回复</button>
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
.page-item-btn {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  border-radius: 0.375rem;
  background: transparent;
  border: 1px solid var(--mb-border-color);
  color: var(--mb-text-main);
  cursor: pointer;
  margin: 0 2px;
}
.page-item.active .page-item-btn {
  background-color: var(--mb-primary);
  border-color: var(--mb-primary);
  color: #ffffff;
}
</style>
