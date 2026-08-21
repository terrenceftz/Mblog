// ============================================================
// MBLOG 三端共享类型（纯 type-only，运行时零开销）
// 真源：backend Drizzle schema 定义数据库形状，本文件记录
// 「前后端 API 契约」的前台视图 + admin 适配层行类型，
// 避免 site / admin 各自重复声明同一批接口返回形状。
// 引用方式：`import type { X } from '@shared/types'`（需各端
// tsconfig 配置 baseUrl + paths），或相对路径引用本文件。
// ============================================================

// ---------- 前台公开契约（site 消费，对应 backend /api/* 返回） ----------

export interface PostListItem {
  id: number; title: string; slug: string; summary: string; cover: string;
  viewCount: number; categoryId: number | null; createdAt: number;
  tags: { name: string; slug: string }[];
}
export interface PostDetail extends PostListItem {
  contentHtml: string;
  updatedAt: number;
  /** 仅详情接口返回（列表接口无此字段） */
  likeCount: number;
  category: { id: number; name: string; slug: string } | null;
  collection: { id: number; name: string; slug: string; description: string } | null;
  prev: { title: string; slug: string } | null;
  next: { title: string; slug: string } | null;
}
export interface Page<T> { list: T[]; total: number }
export interface ThemeConfig {
  bg?: string; text?: string; muted?: string; primary?: string; border?: string;
  fontSize?: number; homePageSize?: number;
  avatar?: string; intro?: string;
}
// 关于页结构化名片块（settings.about_blocks JSON 解析结果）
export type AboutBlock =
  | { type: 'text'; text: string }
  | { type: 'kv'; label: string; value: string; link?: string }
  | { type: 'quote'; text: string; author?: string }
  | { type: 'progress'; title: string; start: string; end: string }
  | { type: 'marquee'; text: string };
export interface PublicSettings {
  siteName: string;
  /** 博主名称（前台首屏"你好，我是X"，后台站点设置可配） */
  author: string;
  /** 博主头像（前台首屏头像，后台站点设置可配，回退主题配置） */
  avatar: string;
  siteDesc: string;
  siteUrl: string;
  theme: string;
  friendLinkEnabled: boolean;
  navMenuNormal: { label: string; url: string }[];
  navMenuReader: { label: string; url: string }[];
  aboutContent: string;
  aboutBlocks: AboutBlock[];
  themeNormal: ThemeConfig;
  themeReader: ThemeConfig;
  githubEnabled: boolean;
  githubUsername: string;
  doubanEnabled: boolean;
  doubanUid: string;
  turnstileSiteKey: string;
  /** 电台歌单 ID（网易云，cookie 不下发仅后端持有） */
  neteasePlaylistId: string;
}
export interface Category { id: number; name: string; slug: string; postCount: number; cover: string }
export interface Collection { id: number; name: string; slug: string; description: string; postCount: number }
export interface Tag { id: number; name: string; slug: string; postCount: number }
export interface ArchiveGroup { month: string; items: { createdAt: number; title: string; slug: string }[] }
export interface Talk { id: number; content: string; createdAt: number }
export interface FriendLink { id: number; name: string; url: string; description: string; avatar: string }
export interface Photo {
  id: number; url: string; title: string; description: string; album: string;
  /** EXIF 摘要 JSON 字符串（机型/光圈/快门/焦距/ISO/时间），可能为空串 */
  exif: string;
}
export interface Project {
  name: string; description: string; url: string;
  language: string | null; stars: number; updatedAt: string;
}
export interface ProjectsData {
  enabled: boolean; username?: string; projects: Project[]; error?: string; stale?: boolean;
}
export interface DoubanMovie {
  title: string;
  url: string;
  cover: string;
  rating: number;
  ratingText: string;
  date: string;
}
export interface DoubanData {
  enabled: boolean;
  uid?: string;
  movies: DoubanMovie[];
  error?: string;
  stale?: boolean;
}
export interface StatsData {
  postTotal: number;
  commentTotal: number;
  totalViews: number;
  friendLinkCount: number;
}

// ---------- admin 后端行契约（对应 backend /api/admin/* 返回） ----------

export interface CategoryRow { id: number; name: string; slug: string; sortOrder: number; postCount: number; cover: string }
export interface CollectionRow { id: number; name: string; slug: string; description: string; sortOrder: number; postCount: number }
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
  categoryId: number | null; collectionId: number | null;
  summary: string; cover: string;
  viewCount: number; createdAt: number; updatedAt: number;
  tags: { name: string; slug: string }[]; commentCount: number;
}
/** 后台文章详情（含编辑所需内容字段，tags 带 id） */
export interface AdminPostDetail {
  id: number; title: string; slug: string; summary: string; cover: string;
  viewCount: number; categoryId: number | null; collectionId: number | null;
  createdAt: number; updatedAt: number;
  contentMd: string; contentHtml: string;
  status: 'draft' | 'published';
  tags: { id: number; name: string; slug: string }[];
  category: { id: number; name: string; slug: string } | null;
}
export interface PostPayload {
  title: string; slug?: string; contentMd: string; summary?: string; cover?: string;
  categoryId?: number | null; collectionId?: number | null; status?: 'draft' | 'published'; tagIds?: number[];
}
export interface TalkRow {
  id: number; content: string; ip: string;
  status: 'pending' | 'approved' | 'rejected'; createdAt: number;
}
export interface PhotoRow {
  id: number; url: string; title: string; description: string; album: string; exif: string;
  sortOrder: number; createdAt: number;
}
