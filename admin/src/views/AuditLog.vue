<script setup lang="ts">
// 操作日志：后台写操作审计（谁、何时、做了什么）。数据来自 backend admin_logs 表。
import { ref, onMounted } from 'vue';
import { api, type AdminLogRow } from '../api/admin';
import { toast } from '../lib/toast';

const rows = ref<AdminLogRow[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const method = ref('');
const loading = ref(false);

const METHODS = [
  { value: '', label: '全部方法' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
];

const totalPages = ref(1);

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function methodBadge(m: string): string {
  const cls: Record<string, string> = {
    POST: 'text-bg-success',
    PUT: 'text-bg-primary',
    PATCH: 'text-bg-info',
    DELETE: 'text-bg-danger',
  };
  return cls[m] ?? 'text-bg-secondary';
}

async function load() {
  loading.value = true;
  try {
    const data = await api.getAuditLogs({ page: page.value, pageSize, method: method.value || undefined });
    rows.value = data.list;
    total.value = data.total;
    totalPages.value = Math.max(1, Math.ceil(data.total / pageSize));
  } catch (e) {
    toast.error('加载操作日志失败');
  } finally {
    loading.value = false;
  }
}

function changeMethod() {
  page.value = 1;
  load();
}
function goPage(p: number) {
  page.value = p;
  load();
}

onMounted(load);
</script>

<template>
  <div class="audit-log-view">
    <div class="page-header">
      <div>
        <h2 class="page-title">操作日志</h2>
        <div class="text-muted">后台写操作审计（新增 / 修改 / 删除），按时间倒序</div>
      </div>
      <div class="d-flex align-items-center gap-2">
        <select v-model="method" class="form-select form-select-sm" style="width: auto" @change="changeMethod">
          <option v-for="m in METHODS" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
        <button class="btn btn-sm btn-outline-secondary" :disabled="loading" @click="load">
          <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
          刷新
        </button>
      </div>
    </div>

    <div class="card">
      <div class="card-header py-3">
        <h3 class="card-title fw-bold m-0">记录 (共 {{ total }} 条)</h3>
      </div>
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th style="width: 150px">时间</th>
              <th style="width: 90px">方法</th>
              <th>路径</th>
              <th style="width: 80px">状态</th>
              <th style="width: 110px">操作人</th>
              <th style="width: 130px">IP</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="6" class="text-center text-muted py-4">加载中…</td>
            </tr>
            <tr v-else-if="rows.length === 0">
              <td colspan="6" class="text-center text-muted py-4">暂无操作记录</td>
            </tr>
            <tr v-for="r in rows" :key="r.id">
              <td class="text-muted font-monospace small">{{ fmtTime(r.createdAt) }}</td>
              <td><span :class="['badge', methodBadge(r.method)]">{{ r.method }}</span></td>
              <td class="font-monospace small text-truncate" style="max-width: 420px" :title="r.path">{{ r.path }}</td>
              <td>
                <span :class="r.status < 300 ? 'text-success' : 'text-danger'" class="font-monospace small">{{ r.status }}</span>
              </td>
              <td class="small">{{ r.username }}</td>
              <td class="text-muted font-monospace small">{{ r.ip || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="totalPages > 1" class="card-body border-top d-flex align-items-center justify-content-between">
        <span class="text-muted small">第 {{ page }} / {{ totalPages }} 页</span>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-secondary" :disabled="page <= 1" @click="goPage(page - 1)">上一页</button>
          <button class="btn btn-sm btn-outline-secondary" :disabled="page >= totalPages" @click="goPage(page + 1)">下一页</button>
        </div>
      </div>
    </div>
  </div>
</template>
