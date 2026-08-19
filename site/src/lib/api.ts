// 三端共享 API 契约类型（真源见仓库根 shared/types.ts）
export type {
  PostListItem,
  PostDetail,
  Page,
  ThemeConfig,
  AboutBlock,
  PublicSettings,
  Category,
  Collection,
  Tag,
  ArchiveGroup,
  Talk,
  FriendLink,
  Photo,
  Project,
  ProjectsData,
  DoubanMovie,
  DoubanData,
  StatsData,
} from '@shared/types';
import type {
  PostListItem,
  PostDetail,
  Page,
  PublicSettings,
  Category,
  Collection,
  Tag,
  ArchiveGroup,
  Talk,
  FriendLink,
  Photo,
  ProjectsData,
  DoubanData,
  StatsData,
} from '@shared/types';

// 服务端渲染时使用；生产容器内经环境变量指向 mblog-api 服务
const API_BASE = process.env.API_BASE ?? 'http://localhost:3000';

// SSR 层短 TTL 缓存 + 单飞去重：首页一次渲染要打 7 个公开接口，且 middleware/页面/同进程
// 多页面会重复拉取同一批数据。仅服务端启用（浏览器端走 island 的即时请求，不缓存以免陈旧）。
const SSR_CACHE_TTL = 30_000;
const ssrCache: Map<string, { at: number; data: unknown }> | null =
  typeof window === 'undefined' ? new Map() : null;
const inflight: Map<string, Promise<unknown>> | null =
  typeof window === 'undefined' ? new Map() : null;

async function get<T>(path: string): Promise<T> {
  if (ssrCache && inflight) {
    const hit = ssrCache.get(path);
    if (hit && Date.now() - hit.at < SSR_CACHE_TTL) return hit.data as T;
    const flying = inflight.get(path);
    if (flying) return flying as Promise<T>;
  }
  // 服务端请求带真实访客 IP（nginx x-real-ip → ALS → 后端阅读量去重/统计按真实 IP 生效）。
  // 动态 import 避免浏览器端 island 引到 node:async_hooks。
  let ipHeader: Record<string, string> = {};
  if (typeof window === 'undefined') {
    const { requestALS } = await import('./requestContext');
    const ip = requestALS.getStore()?.ip;
    if (ip) ipHeader = { 'x-real-ip': ip };
  }
  // 12s 超时兜底：外部接口（豆瓣/GitHub 等）异常慢时 SSR 不挂死，区块走调用方 .catch 优雅降级
  const p = (async () => {
    const res = await fetch(`${API_BASE}/api${path}`, {
      headers: { Accept: 'application/json', ...ipHeader },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`API ${path} -> ${res.status}`);
    const body = (await res.json()) as { data: T };
    if (ssrCache) ssrCache.set(path, { at: Date.now(), data: body.data });
    return body.data;
  })();
  if (ssrCache && inflight) {
    inflight.set(path, p);
    // 失败/成功后清理单飞记录（失败不缓存，下次重试）
    p.catch(() => {}).then(() => inflight!.delete(path));
  }
  return p;
}

export async function getPublicSettings(): Promise<PublicSettings> {
  return get<PublicSettings>('/settings/public').catch(() => ({
    siteName: '我的博客', author: '', avatar: '', siteDesc: '', siteUrl: 'http://localhost', theme: 'normal', friendLinkEnabled: true,
    themeNormal: {}, themeReader: {}, githubEnabled: false, githubUsername: '',
    doubanEnabled: false, doubanUid: '', turnstileSiteKey: '', aboutContent: '', aboutBlocks: [], neteasePlaylistId: '',
    navMenuNormal: [
      { label: '首页', url: '/' },
      { label: '归档', url: '/archive' },
      { label: '友链', url: '/friends' },
      { label: '项目', url: '/projects' },
      { label: '影音', url: '/douban' },
      { label: '相册', url: '/gallery' },
      { label: '关于', url: '/about' },
      { label: 'RSS', url: '/api/rss' },
    ],
    navMenuReader: [
      { label: '首页', url: '/' },
      { label: '归档', url: '/archive' },
      { label: '友链', url: '/friends' },
      { label: '项目', url: '/projects' },
      { label: '影音', url: '/douban' },
      { label: '相册', url: '/gallery' },
      { label: '关于', url: '/about' },
      { label: 'RSS', url: '/api/rss' },
    ],
  }));
}

export function getPosts(params: { page?: number; pageSize?: number; category?: string; tag?: string; collection?: string; q?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  if (params.category) qs.set('category', params.category);
  if (params.tag) qs.set('tag', params.tag);
  if (params.collection) qs.set('collection', params.collection);
  if (params.q) qs.set('q', params.q);
  return get<Page<PostListItem>>(`/posts?${qs.toString()}`);
}
export const getPost = (slug: string) => get<PostDetail>(`/posts/${slug}`);
export const getCategories = () => get<Category[]>('/categories');
export const getCollections = () => get<Collection[]>('/collections');
export const getTags = () => get<Tag[]>('/tags');
export const getArchive = () => get<ArchiveGroup[]>('/archive');
export const getFriendLinks = () => get<FriendLink[]>('/friend-links');
export const getTalks = () => get<Talk[]>('/talks');
export const getPhotos = () => get<Photo[]>('/photos');
export const getProjects = () => get<ProjectsData>('/projects');
export const getDouban = () => get<DoubanData>('/douban');
export const getStats = () => get<StatsData>('/stats');
