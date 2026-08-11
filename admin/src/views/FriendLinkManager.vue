<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api, type FriendLink } from '../api/admin';
import { toast } from '../lib/toast';

const links = ref<FriendLink[]>([]);
const activeStatus = ref<string>('all');
const showAddModal = ref(false);

const newLink = ref({
  name: '',
  url: '',
  logo: '',
  description: '',
});

async function loadLinks() {
  links.value = await api.getFriendLinks();
}

const filteredLinks = computed(() => {
  if (activeStatus.value === 'all') return links.value;
  return links.value.filter((l) => l.status === activeStatus.value);
});

async function handleUpdateStatus(id: number, status: FriendLink['status']) {
  await api.updateFriendLinkStatus(id, status);
  toast.success(status === 'approved' ? '友链已审核通过' : '已拒绝');
  loadLinks();
}

async function handleAddLink() {
  if (!newLink.value.name.trim() || !newLink.value.url.trim()) {
    toast.warning('请输入网站名称和网址');
    return;
  }

  await api.saveFriendLink({
    name: newLink.value.name.trim(),
    url: newLink.value.url.trim(),
    logo: newLink.value.logo.trim() || undefined,
    description: newLink.value.description.trim(),
  });

  toast.success('友链已成功添加');
  showAddModal.value = false;
  newLink.value = { name: '', url: '', logo: '', description: '' };
  loadLinks();
}

async function handleDelete(id: number, name: string) {
  if (confirm(`确定要删除友链 "${name}" 吗？`)) {
    await api.deleteFriendLink(id);
    toast.success('友链已删除');
    loadLinks();
  }
}

onMounted(() => {
  loadLinks();
});
</script>

<template>
  <div class="friend-link-manager-view">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h2 class="page-title">友情链接管理</h2>
        <div class="text-muted">审核博客博友交换的友情链接申请与维护</div>
      </div>

      <button @click="showAddModal = true" class="btn btn-primary d-flex align-items-center gap-1 shadow-sm">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span>添加友链</span>
      </button>
    </div>

    <!-- Status Filter Pills -->
    <div class="card mb-4">
      <div class="card-header p-2">
        <ul class="nav nav-pills card-header-pills">
          <li class="nav-item">
            <button
              class="nav-link px-3 py-1.5 small rounded-2"
              :class="{ active: activeStatus === 'all' }"
              @click="activeStatus = 'all'"
            >
              全部友链 ({{ links.length }})
            </button>
          </li>
          <li class="nav-item">
            <button
              class="nav-link px-3 py-1.5 small rounded-2"
              :class="{ active: activeStatus === 'pending' }"
              @click="activeStatus = 'pending'"
            >
              待审核 ({{ links.filter(l => l.status === 'pending').length }})
            </button>
          </li>
          <li class="nav-item">
            <button
              class="nav-link px-3 py-1.5 small rounded-2"
              :class="{ active: activeStatus === 'approved' }"
              @click="activeStatus = 'approved'"
            >
              已通过 ({{ links.filter(l => l.status === 'approved').length }})
            </button>
          </li>
          <li class="nav-item">
            <button
              class="nav-link px-3 py-1.5 small rounded-2"
              :class="{ active: activeStatus === 'rejected' }"
              @click="activeStatus = 'rejected'"
            >
              已拒绝 ({{ links.filter(l => l.status === 'rejected').length }})
            </button>
          </li>
        </ul>
      </div>
    </div>

    <!-- Friend Links Table -->
    <div class="card">
      <div class="table-responsive">
        <table class="table table-vcenter card-table table-hover">
          <thead>
            <tr>
              <th>站点名称 / Logo</th>
              <th>网址</th>
              <th>站点描述</th>
              <th>状态</th>
              <th>申请时间</th>
              <th class="text-end">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredLinks.length === 0">
              <td colspan="6" class="text-center text-muted py-5">
                暂无此分类下的友链
              </td>
            </tr>

            <tr v-for="link in filteredLinks" :key="link.id">
              <td>
                <div class="d-flex align-items-center gap-3">
                  <img
                    :src="link.logo || 'https://api.dicebear.com/7.x/identicon/svg?seed=' + link.name"
                    class="avatar avatar-sm rounded-circle border"
                    alt="logo"
                  />
                  <div class="fw-bold text-main">{{ link.name }}</div>
                </div>
              </td>

              <td>
                <a :href="link.url" target="_blank" class="font-monospace text-decoration-none small text-primary">
                  {{ link.url }}
                </a>
              </td>

              <td class="text-muted small">{{ link.description || '暂无描述' }}</td>

              <td>
                <span v-if="link.status === 'approved'" class="badge badge-soft-success">已通过</span>
                <span v-else-if="link.status === 'pending'" class="badge badge-soft-warning">待审核</span>
                <span v-else class="badge badge-soft-danger">已拒绝</span>
              </td>

              <td class="small text-muted">{{ link.created_at.substring(0, 10) }}</td>

              <td class="text-end">
                <div class="btn-list flex-nowrap justify-content-end">
                  <button
                    v-if="link.status !== 'approved'"
                    @click="handleUpdateStatus(link.id, 'approved')"
                    class="btn btn-sm btn-ghost-success"
                  >
                    通过
                  </button>
                  <button
                    v-if="link.status !== 'rejected'"
                    @click="handleUpdateStatus(link.id, 'rejected')"
                    class="btn btn-sm btn-ghost-warning"
                  >
                    拒绝
                  </button>
                  <button @click="handleDelete(link.id, link.name)" class="btn btn-sm btn-ghost-danger">
                    删除
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add Friend Link Modal -->
    <div v-if="showAddModal" class="modal fade show d-block bg-dark bg-opacity-50" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content card">
          <div class="modal-header border-bottom py-3">
            <h5 class="modal-title fw-bold">添加新友情链接</h5>
            <button type="button" class="btn-close" @click="showAddModal = false"></button>
          </div>
          <div class="modal-body p-4">
            <div class="mb-3">
              <label class="form-label small fw-medium">站点名称</label>
              <input type="text" v-model="newLink.name" class="form-control" placeholder="如：阮一峰的网络日志" />
            </div>
            <div class="mb-3">
              <label class="form-label small fw-medium">站点 URL</label>
              <input type="text" v-model="newLink.url" class="form-control" placeholder="https://" />
            </div>
            <div class="mb-3">
              <label class="form-label small fw-medium">Logo / Favicon 链接</label>
              <input type="text" v-model="newLink.logo" class="form-control" placeholder="https://.../favicon.ico (选填)" />
            </div>
            <div class="mb-3">
              <label class="form-label small fw-medium">描述</label>
              <input type="text" v-model="newLink.description" class="form-control" placeholder="简短博主描述" />
            </div>
          </div>
          <div class="modal-footer border-top">
            <button type="button" class="btn btn-secondary" @click="showAddModal = false">取消</button>
            <button type="button" class="btn btn-primary" @click="handleAddLink">保存友链</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
