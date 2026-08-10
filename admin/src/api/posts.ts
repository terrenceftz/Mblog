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
