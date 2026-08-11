import { request } from './client';
import type { PostDetail, Page } from './posts';

export interface CategoryRow { id: number; name: string; slug: string; sortOrder: number; postCount: number }
export interface TagRow { id: number; name: string; slug: string; postCount: number }
export interface CommentRow {
  id: number; postId: number; author: string; email: string; content: string;
  status: 'pending' | 'approved' | 'rejected'; parentId: number | null; createdAt: number;
}
export interface FriendLinkRow {
  id: number; name: string; url: string; description: string; avatar: string;
  status: 'pending' | 'approved' | 'rejected'; createdAt: number;
}
export interface AdminPostRow {
  id: number; title: string; slug: string; status: 'draft' | 'published';
  categoryId: number | null; viewCount: number; createdAt: number; updatedAt: number;
}
export interface AdminPostDetail extends Omit<PostDetail, 'tags'> {
  tags: { id: number; name: string; slug: string }[];
}

// 仅在有查询参数时才追加 ?…，避免生成 /admin/posts? 之类的空查询串
function buildQuery(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export function login(username: string, password: string) {
  return request<{ token: string }>('/admin/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}
export function logout() {
  localStorage.removeItem('admin_token');
}

export function adminChangePassword(oldPassword: string, newPassword: string) {
  return request<{ message: string }>('/admin/password', {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword }),
  });
}

export function getStats() {
  return request<{ postTotal: number; published: number; commentTotal: number; pendingComments: number; totalViews: number }>('/admin/stats');
}

export function adminGetPosts(params: { page?: number; pageSize?: number; status?: string; categoryId?: number } = {}) {
  return request<Page<AdminPostRow>>(`/admin/posts${buildQuery(params)}`);
}
export function adminGetPost(id: number) {
  return request<AdminPostDetail>(`/admin/posts/${id}`);
}
export interface PostPayload {
  title: string; slug?: string; contentMd: string; summary?: string; cover?: string;
  categoryId?: number | null; status?: 'draft' | 'published'; tagIds?: number[];
}
export function adminCreatePost(payload: PostPayload) {
  return request<{ id: number }>('/admin/posts', { method: 'POST', body: JSON.stringify(payload) });
}
export function adminUpdatePost(id: number, payload: PostPayload) {
  return request<{ id: number }>(`/admin/posts/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}
export function adminDeletePost(id: number) {
  return request<{ ok: true }>(`/admin/posts/${id}`, { method: 'DELETE' });
}

export function adminGetComments(params: { status?: string; page?: number; pageSize?: number } = {}) {
  return request<Page<CommentRow>>(`/admin/comments${buildQuery(params)}`);
}
export function adminPatchComment(id: number, status: CommentRow['status']) {
  return request<{ id: number; status: string }>(`/admin/comments/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
}
export function adminDeleteComment(id: number) {
  return request<{ ok: true }>(`/admin/comments/${id}`, { method: 'DELETE' });
}
export function adminReplyComment(id: number, content: string) {
  return request<{ ok: true }>(`/admin/comments/${id}/reply`, { method: 'POST', body: JSON.stringify({ content }) });
}
export function adminBatchComments(ids: number[], action: 'approve' | 'reject' | 'delete') {
  return request<{ ok: true }>('/admin/comments/batch', { method: 'POST', body: JSON.stringify({ ids, action }) });
}

export interface TalkRow { id: number; content: string; ip: string; status: 'pending' | 'approved' | 'rejected'; createdAt: number }
export function adminGetTalks(params: { status?: string; page?: number; pageSize?: number } = {}) {
  return request<Page<TalkRow>>(`/admin/talks${buildQuery(params)}`);
}
export function adminPatchTalk(id: number, status: TalkRow['status']) {
  return request<{ id: number; status: string }>(`/admin/talks/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export function adminGetFriendLinks(params: { status?: string } = {}) {
  return request<FriendLinkRow[]>(`/admin/friend-links${buildQuery(params)}`);
}
export function adminPutFriendLink(id: number, payload: Partial<FriendLinkRow>) {
  return request<{ id: number }>(`/admin/friend-links/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}
export function adminDeleteFriendLink(id: number) {
  return request<{ ok: true }>(`/admin/friend-links/${id}`, { method: 'DELETE' });
}

export function adminGetCategories(): Promise<CategoryRow[]> { return request('/admin/categories'); }
export function adminCreateCategory(payload: { name: string; slug?: string; sortOrder?: number }) {
  return request<CategoryRow>('/admin/categories', { method: 'POST', body: JSON.stringify(payload) });
}
export function adminUpdateCategory(id: number, payload: Partial<CategoryRow>) {
  return request<{ id: number }>(`/admin/categories/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}
export function adminDeleteCategory(id: number) {
  return request<{ ok: true }>(`/admin/categories/${id}`, { method: 'DELETE' });
}

export function adminGetTags(): Promise<TagRow[]> { return request('/admin/tags'); }
export function adminCreateTag(payload: { name: string; slug?: string }) {
  return request<TagRow>('/admin/tags', { method: 'POST', body: JSON.stringify(payload) });
}
export function adminUpdateTag(id: number, payload: Partial<TagRow>) {
  return request<{ id: number }>(`/admin/tags/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}
export function adminDeleteTag(id: number) {
  return request<{ ok: true }>(`/admin/tags/${id}`, { method: 'DELETE' });
}

export function adminGetSettings(): Promise<Record<string, string>> { return request('/admin/settings'); }
export function adminPutSettings(payload: Record<string, string>) {
  return request<Record<string, string>>('/admin/settings', { method: 'PUT', body: JSON.stringify(payload) });
}
export function adminSyncDouban(signal?: AbortSignal): Promise<{ count: number }> {
  return request('/admin/douban/sync', { method: 'POST', signal });
}

export function uploadFile(file: File): Promise<{ url: string; key: string }> {
  const form = new FormData();
  form.append('file', file);
  return request('/admin/upload', { method: 'POST', body: form });
}
