// 服务端渲染时使用；生产容器内经环境变量指向 mblog-api 服务
const API_BASE = process.env.API_BASE ?? 'http://localhost:3000';

export interface PostListItem {
  id: number; title: string; slug: string; summary: string; cover: string;
  viewCount: number; likeCount: number; categoryId: number | null; createdAt: number;
  tags: { name: string; slug: string }[];
}
export interface PostDetail extends PostListItem {
  contentHtml: string;
  category: { id: number; name: string; slug: string } | null;
  prev: { title: string; slug: string } | null;
  next: { title: string; slug: string } | null;
}
export interface Page<T> { list: T[]; total: number }
export interface ThemeConfig {
  bg?: string; text?: string; muted?: string; primary?: string; border?: string;
  fontSize?: number; homePageSize?: number;
  avatar?: string; intro?: string;
}
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
  navMenu: { label: string; url: string }[];
  themeNormal: ThemeConfig;
  themeReader: ThemeConfig;
  githubEnabled: boolean;
  githubUsername: string;
  doubanEnabled: boolean;
  doubanUid: string;
  turnstileSiteKey: string;
}
export interface Category { id: number; name: string; slug: string; postCount: number }
export interface Tag { id: number; name: string; slug: string; postCount: number }
export interface ArchiveGroup { month: string; items: { createdAt: number; title: string; slug: string }[] }
export interface Talk { id: number; content: string; createdAt: number }
export interface FriendLink { id: number; name: string; url: string; description: string; avatar: string }
export interface Project {
  name: string; description: string; url: string;
  language: string | null; stars: number; updatedAt: string;
}
export interface ProjectsData {
  enabled: boolean; username?: string; projects: Project[]; error?: string; stale?: boolean;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`API ${path} -> ${res.status}`);
  const body = (await res.json()) as { data: T };
  return body.data;
}

export function getPublicSettings(): Promise<PublicSettings> {
  return get<PublicSettings>('/settings/public').catch(() => ({
    siteName: '我的博客', author: '', avatar: '', siteDesc: '', siteUrl: 'http://localhost', theme: 'normal', friendLinkEnabled: true,
    themeNormal: {}, themeReader: {}, githubEnabled: false, githubUsername: '',
    doubanEnabled: false, doubanUid: '', turnstileSiteKey: '',
    navMenu: [
      { label: '首页', url: '/' },
      { label: '归档', url: '/archive' },
      { label: '友链', url: '/friends' },
      { label: '项目', url: '/projects' },
      { label: '影音', url: '/douban' },
      { label: 'RSS', url: '/api/rss' },
    ],
  }));
}

export function getPosts(params: { page?: number; pageSize?: number; category?: string; tag?: string; q?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  if (params.category) qs.set('category', params.category);
  if (params.tag) qs.set('tag', params.tag);
  if (params.q) qs.set('q', params.q);
  return get<Page<PostListItem>>(`/posts?${qs.toString()}`);
}
export const getPost = (slug: string) => get<PostDetail>(`/posts/${slug}`);
export const getCategories = () => get<Category[]>('/categories');
export const getTags = () => get<Tag[]>('/tags');
export const getArchive = () => get<ArchiveGroup[]>('/archive');
export const getFriendLinks = () => get<FriendLink[]>('/friend-links');
export const getTalks = () => get<Talk[]>('/talks');
export const getProjects = () => get<ProjectsData>('/projects');
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
export const getDouban = () => get<DoubanData>('/douban');

export interface StatsData {
  postTotal: number;
  commentTotal: number;
  totalViews: number;
  friendLinkCount: number;
}
export const getStats = () => get<StatsData>('/stats');
