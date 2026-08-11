export interface PostListItem {
  id: number; title: string; slug: string; summary: string; cover: string;
  viewCount: number; categoryId: number | null; createdAt: number;
}
export interface PostDetail extends PostListItem {
  contentMd: string;
  contentHtml: string;
  status: 'draft' | 'published';
  tags: { id: number; name: string; slug: string }[];
  category: { id: number; name: string; slug: string } | null;
}
export interface Page<T> { list: T[]; total: number }

/* ============ 后端真实契约类型（Gemini API 适配层使用） ============ */
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
export interface PostPayload {
  title: string; slug?: string; contentMd: string; summary?: string; cover?: string;
  categoryId?: number | null; status?: 'draft' | 'published'; tagIds?: number[];
}
export interface TalkRow {
  id: number; content: string; ip: string;
  status: 'pending' | 'approved' | 'rejected'; createdAt: number;
}
