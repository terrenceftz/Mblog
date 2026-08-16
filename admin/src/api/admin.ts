export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// Data Interfaces
export interface DashboardStats {
  postCount: number;
  commentCount: number;
  pendingComments: number;
  pendingFriendLinks: number;
  pendingTalks: number;
  todayViews: number;
  monthViews: number;
}

export interface Post {
  id: number;
  title: string;
  slug: string;
  content: string;
  summary: string;
  categoryId: number;
  categoryName: string;
  tags: string[];
  status: 'published' | 'draft' | 'archived';
  cover: string;
  views: number;
  commentCount: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  postCount: number;
  cover: string;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
  postCount: number;
}

export interface Comment {
  id: number;
  postId: number;
  postTitle: string;
  author: string;
  email: string;
  website: string;
  avatar: string;
  content: string;
  ip: string;
  userAgent: string;
  status: 'approved' | 'pending' | 'spam' | 'rejected';
  replyContent?: string;
  created_at: string;
}

export interface Talk {
  id: number;
  content: string;
  status: 'approved' | 'pending' | 'rejected';
  likeCount: number;
  created_at: string;
}

export interface Photo {
  id: number;
  url: string;
  title: string;
  description: string;
  sortOrder: number;
  created_at: string;
}

export interface FriendLink {
  id: number;
  name: string;
  url: string;
  logo: string;
  description: string;
  status: 'approved' | 'pending' | 'rejected';
  created_at: string;
}

export interface SiteSettings {
  title: string;
  subtitle: string;
  author: string;
  avatar: string;
  apiKey: string;
  apiSecret: string;
  doubanUserId: string;
  doubanApiKey: string;
  doubanSyncEnabled: boolean;
  lastDoubanSync?: string;
  /** 站点地址（RSS） */
  siteUrl: string;
  /** 默认主题 normal/reader */
  defaultTheme: string;
  /** 评论人机验证（Turnstile） */
  turnstileSiteKey: string;
  turnstileSecretKey: string;
  /** 友链申请开关 */
  friendLinkEnabled: boolean;
  /** GitHub 项目展示 */
  githubEnabled: boolean;
  githubUsername: string;
  /** 导航菜单 JSON 字符串（双主题各自） */
  navMenuNormal: string;
  navMenuReader: string;
  /** 关于页内容（纯文本段落） */
  aboutContent: string;
  aboutBlocks: string;
  /** 存储方式 local/cos */
  storageProvider: string;
  cosBucket: string;
  cosRegion: string;
  /** 电台（网易云） */
  neteaseCookie: string;
  neteasePlaylistId: string;
}

export interface ThemeColors {
  bg: string;
  text: string;
  muted: string;
  primary: string;
  border: string;
  avatar: string;
  intro: string;
}

export interface ThemeConfig {
  layoutMode: 'normal' | 'reader';
  colorPalette: 'amber' | 'blue' | 'emerald' | 'purple';
  fontSize: number;
  postsPerPage: number;
  /** 主题配色细节（normal/reader 各自维护） */
  colors: Record<'normal' | 'reader', ThemeColors>;
}

/* =========================================================
   API 适配层：Gemini UI 的 api.xxx() 接口 → 真实后端
   保留 Gemini 的方法签名与数据类型（页面模板依赖），
   实现全部改为调用真实 Hono 后端（fetch 封装见 client.ts），
   并把后端返回字段映射为 Gemini 期望的形状。
   ========================================================= */
import { request, ApiError } from './client';
import type {
  Page,
  AdminPostDetail,
  AdminPostRow,
  CategoryRow,
  TagRow,
  CommentRow,
  FriendLinkRow,
  TalkRow,
  PhotoRow,
  PostPayload
} from './posts';

const TOKEN_KEY = 'admin_token';

/** 时间戳 → 'YYYY-MM-DD HH:mm' */
function fmtTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 评论状态：Gemini 含 'spam'，后端无 → 映射 rejected */
function mapCommentStatus(s: CommentRow['status']): Comment['status'] {
  return s === 'rejected' ? 'rejected' : s === 'approved' ? 'approved' : 'pending';
}
function unmapCommentStatus(s: Comment['status']): CommentRow['status'] {
  return s === 'spam' ? 'rejected' : s;
}

/** 分类 id → 名称 映射缓存 */
let categoryNameMap: Record<number, string> = {};
async function refreshCategoryMap() {
  try {
    const cats = await api.getCategories();
    categoryNameMap = Object.fromEntries(cats.map(c => [c.id, c.name]));
  } catch {
    categoryNameMap = {};
  }
}

export const api = {
  // ---------- 认证 ----------
  async checkAuth(): Promise<boolean> {
    return !!localStorage.getItem(TOKEN_KEY);
  },

  async login(username: string, password: string): Promise<boolean> {
    const { token } = await request<{ token: string }>('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    localStorage.setItem(TOKEN_KEY, token);
    return true;
  },

  async logout(): Promise<void> {
    localStorage.removeItem(TOKEN_KEY);
  },

  // ---------- 统计 ----------
  async getDashboardStats(): Promise<DashboardStats> {
    const s = await request<{
      postTotal: number;
      published: number;
      commentTotal: number;
      pendingComments: number;
      totalViews: number;
    }>('/admin/stats');
    return {
      postCount: s.postTotal,
      commentCount: s.commentTotal,
      pendingComments: s.pendingComments,
      pendingFriendLinks: 0, // 后端无单独统计
      pendingTalks: 0,
      todayViews: s.totalViews,
      monthViews: 0
    };
  },

  // ---------- 文章 ----------
  async getPosts(categoryId?: number, status?: string): Promise<Post[]> {
    await refreshCategoryMap();
    const { list } = await request<Page<AdminPostRow>>(
      `/admin/posts?page=1&pageSize=100${categoryId ? `&categoryId=${categoryId}` : ''}${status ? `&status=${status}` : ''}`
    );
    return list.map(p => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      content: '',
      summary: '',
      categoryId: p.categoryId ?? 0,
      categoryName: p.categoryId ? (categoryNameMap[p.categoryId] ?? '') : '',
      tags: [],
      status: p.status as Post['status'],
      cover: '',
      views: p.viewCount,
      commentCount: 0,
      created_at: fmtTime(p.createdAt),
      updated_at: fmtTime(p.createdAt)
    }));
  },

  async getPostById(id: number): Promise<Post | undefined> {
    const p = await request<AdminPostDetail>(`/admin/posts/${id}`);
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      content: p.contentMd,
      summary: p.summary,
      categoryId: p.categoryId ?? 0,
      categoryName: p.category?.name ?? '',
      tags: p.tags.map(t => t.name),
      status: p.status as Post['status'],
      cover: p.cover,
      views: p.viewCount,
      commentCount: 0,
      created_at: fmtTime(p.createdAt),
      updated_at: fmtTime(p.createdAt)
    };
  },

  async savePost(postData: Partial<Post>): Promise<Post> {
    // 标签名称 → id
    const tagRows = await request<TagRow[]>('/admin/tags');
    const tagIds = (postData.tags ?? [])
      .map(name => tagRows.find(t => t.name === name)?.id)
      .filter((v): v is number => !!v);
    const payload: PostPayload = {
      title: postData.title || '无标题文章',
      slug: postData.slug || undefined,
      contentMd: postData.content || '',
      summary: postData.summary || '',
      cover: postData.cover || '',
      categoryId: postData.categoryId || null,
      status: (postData.status === 'published' ? 'published' : 'draft') as 'draft' | 'published',
      tagIds
    };
    if (postData.id) {
      await request<{ id: number }>(`/admin/posts/${postData.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      return (await api.getPostById(postData.id))!;
    }
    const { id } = await request<{ id: number }>('/admin/posts', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return (await api.getPostById(id))!;
  },

  async deletePost(id: number): Promise<boolean> {
    await request<{ ok: true }>(`/admin/posts/${id}`, { method: 'DELETE' });
    return true;
  },

  // ---------- 分类 ----------
  async getCategories(): Promise<Category[]> {
    const rows = await request<CategoryRow[]>('/admin/categories');
    return rows.map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: '',
      postCount: c.postCount,
      cover: c.cover || ''
    }));
  },

  async saveCategory(cat: Partial<Category>): Promise<Category> {
    if (cat.id) {
      await request<{ id: number }>(`/admin/categories/${cat.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: cat.name, slug: cat.slug, cover: cat.cover })
      });
      return {
        id: cat.id,
        name: cat.name || '',
        slug: cat.slug || '',
        description: '',
        postCount: cat.postCount || 0,
        cover: cat.cover || ''
      };
    }
    const row = await request<CategoryRow>('/admin/categories', {
      method: 'POST',
      body: JSON.stringify({ name: cat.name, slug: cat.slug, cover: cat.cover })
    });
    return { id: row.id, name: row.name, slug: row.slug, description: '', postCount: row.postCount, cover: row.cover || '' };
  },

  async deleteCategory(id: number): Promise<boolean> {
    await request<{ ok: true }>(`/admin/categories/${id}`, { method: 'DELETE' });
    return true;
  },

  // ---------- 电台（网易云） ----------
  /** 拉取账号收藏歌单（供后台选择当前电台歌单） */
  async getNeteasePlaylists(): Promise<{ id: number; name: string; cover: string; count: number }[]> {
    const r = await request<{ playlists: { id: number; name: string; cover: string; count: number }[] }>('/admin/netease/playlists');
    return r.playlists || [];
  },
  /** 发送网易云短信验证码 */
  async neteaseSendCode(phone: string): Promise<boolean> {
    await request<{ ok: true }>('/admin/netease/sendcode', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
    return true;
  },
  /** 手机号 + 验证码登录网易云（自动保存 Cookie 到后端） */
  async neteaseLogin(phone: string, code: string): Promise<{ message: string }> {
    const r = await request<{ ok: true; message: string }>('/admin/netease/login', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    });
    return { message: r.message || '登录成功' };
  },

  // ---------- 标签 ----------
  async getTags(): Promise<Tag[]> {
    const rows = await request<TagRow[]>('/admin/tags');
    return rows.map(t => ({ id: t.id, name: t.name, slug: t.slug, postCount: t.postCount }));
  },

  async addTag(name: string, slug?: string): Promise<Tag> {
    const row = await request<TagRow>('/admin/tags', {
      method: 'POST',
      body: JSON.stringify({ name, slug })
    });
    return { id: row.id, name: row.name, slug: row.slug, postCount: row.postCount };
  },

  async deleteTag(id: number): Promise<boolean> {
    await request<{ ok: true }>(`/admin/tags/${id}`, { method: 'DELETE' });
    return true;
  },

  // ---------- 评论 ----------
  async getComments(statusFilter?: string): Promise<Comment[]> {
    const { list } = await request<Page<CommentRow>>(
      `/admin/comments?page=1&pageSize=100${statusFilter && statusFilter !== 'all' ? `&status=${statusFilter}` : ''}`
    );
    // 评论 → 文章标题映射
    let postTitleMap: Record<number, string> = {};
    try {
      const posts = await api.getPosts();
      postTitleMap = Object.fromEntries(posts.map(p => [p.id, p.title]));
    } catch {
      postTitleMap = {};
    }
    return list.map(c => ({
      id: c.id,
      postId: c.postId,
      postTitle: postTitleMap[c.postId] ?? '',
      author: c.author,
      email: c.email,
      website: '',
      avatar: '',
      content: c.content,
      ip: '',
      userAgent: '',
      status: mapCommentStatus(c.status),
      replyContent: undefined,
      created_at: fmtTime(c.createdAt)
    }));
  },

  async updateCommentStatus(id: number, status: Comment['status'], replyContent?: string): Promise<boolean> {
    await request<{ id: number; status: string }>(`/admin/comments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: unmapCommentStatus(status) })
    });
    if (replyContent) {
      await request<{ ok: true }>(`/admin/comments/${id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ content: replyContent })
      });
    }
    return true;
  },

  async batchUpdateComments(ids: number[], action: 'approve' | 'spam' | 'delete'): Promise<boolean> {
    await request<{ ok: true }>('/admin/comments/batch', {
      method: 'POST',
      body: JSON.stringify({ ids, action: action === 'spam' ? 'reject' : action })
    });
    return true;
  },

  // ---------- 相册 ----------
  async getPhotos(): Promise<Photo[]> {
    const { list } = await request<Page<PhotoRow>>('/admin/photos?page=1&pageSize=100');
    return list.map(p => ({
      id: p.id,
      url: p.url,
      title: p.title,
      description: p.description,
      sortOrder: p.sortOrder,
      created_at: fmtTime(p.createdAt),
    }));
  },

  async createPhoto(input: { url: string; title?: string; description?: string }): Promise<Photo> {
    await request<{ url: string }>('/admin/photos', { method: 'POST', body: JSON.stringify(input) });
    const list = await api.getPhotos();
    return list[0];
  },

  async updatePhoto(id: number, input: { url?: string; title?: string; description?: string }): Promise<boolean> {
    await request<{ id: number }>(`/admin/photos/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
    return true;
  },

  async deletePhoto(id: number): Promise<boolean> {
    await request<{ ok: true }>(`/admin/photos/${id}`, { method: 'DELETE' });
    return true;
  },

  /** 上传图片，返回可访问 url（复用 /admin/upload）；blob 可传压缩后的图 */
  async uploadPhoto(file: Blob, filename: string): Promise<string> {
    const fd = new FormData();
    fd.append('file', file, filename);
    const data = await request<{ url: string }>('/admin/upload', { method: 'POST', body: fd });
    return data.url;
  },

  // ---------- 说说 ----------
  async getTalks(): Promise<Talk[]> {
    const { list } = await request<Page<TalkRow>>('/admin/talks?page=1&pageSize=100');
    return list.map(t => ({
      id: t.id,
      content: t.content,
      status: t.status as Talk['status'],
      likeCount: 0,
      created_at: fmtTime(t.createdAt)
    }));
  },

  async createTalk(content: string): Promise<Talk> {
    await request<{ message: string }>('/admin/talks', {
      method: 'POST',
      body: JSON.stringify({ content })
    });
    const list = await api.getTalks();
    return list[0];
  },

  async updateTalkStatus(id: number, status: Talk['status']): Promise<boolean> {
    await request<{ id: number; status: string }>(`/admin/talks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    return true;
  },

  async deleteTalk(id: number): Promise<boolean> {
    await request<{ ok: true }>(`/admin/talks/${id}`, { method: 'DELETE' });
    return true;
  },

  // ---------- 友链 ----------
  async getFriendLinks(): Promise<FriendLink[]> {
    const rows = await request<FriendLinkRow[]>('/admin/friend-links');
    return rows.map(l => ({
      id: l.id,
      name: l.name,
      url: l.url,
      logo: l.avatar,
      description: l.description,
      status: l.status as FriendLink['status'],
      created_at: fmtTime(l.createdAt)
    }));
  },

  async updateFriendLinkStatus(id: number, status: FriendLink['status']): Promise<boolean> {
    await request<{ id: number }>(`/admin/friend-links/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    return true;
  },

  async saveFriendLink(link: Partial<FriendLink>): Promise<FriendLink> {
    if (link.id) {
      await request<{ id: number }>(`/admin/friend-links/${link.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: link.name, url: link.url, description: link.description, logo: link.logo, status: link.status })
      });
      return {
        id: link.id,
        name: link.name || '',
        url: link.url || '',
        logo: link.logo || '',
        description: link.description || '',
        status: link.status || 'pending',
        created_at: ''
      };
    }
    const row = await request<FriendLinkRow>('/admin/friend-links', {
      method: 'POST',
      body: JSON.stringify({ name: link.name, url: link.url, description: link.description, avatar: link.logo, status: 'pending' })
    });
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      logo: row.avatar,
      description: row.description,
      status: row.status as FriendLink['status'],
      created_at: ''
    };
  },

  async deleteFriendLink(id: number): Promise<boolean> {
    await request<{ ok: true }>(`/admin/friend-links/${id}`, { method: 'DELETE' });
    return true;
  },

  // ---------- 设置 ----------
  async getSettings(): Promise<SiteSettings> {
    const s = await request<Record<string, string>>('/admin/settings');
    return {
      title: s.site_name || '',
      subtitle: s.site_description || '',
      author: s.author || '',
      avatar: s.avatar || '',
      apiKey: s.cos_secret_id || '',
      apiSecret: s.cos_secret_key || '',
      doubanUserId: s.douban_uid || '',
      doubanApiKey: s.tmdb_api_key || '',
      doubanSyncEnabled: s.douban_enabled === '1',
      lastDoubanSync: s.douban_last_sync || '',
      siteUrl: s.site_url || '',
      defaultTheme: s.default_theme || 'normal',
      turnstileSiteKey: s.turnstile_site_key || '',
      turnstileSecretKey: s.turnstile_secret_key || '',
      friendLinkEnabled: s.friend_link_enabled === '1',
      githubEnabled: s.github_enabled === '1',
      githubUsername: s.github_username || '',
      navMenuNormal: s.nav_menu_normal || '[]',
      navMenuReader: s.nav_menu_reader || '[]',
      aboutContent: s.about_content || '',
      aboutBlocks: s.about_blocks || '[]',
      storageProvider: s.storage_provider || 'local',
      cosBucket: s.cos_bucket || '',
      cosRegion: s.cos_region || '',
      neteaseCookie: s.netease_cookie || '',
      neteasePlaylistId: s.netease_playlist_id || ''
    };
  },

  async updateSettings(settings: Partial<SiteSettings>): Promise<SiteSettings> {
    const current = await request<Record<string, string>>('/admin/settings');
    const boolStr = (v: boolean | undefined, fallback: string) =>
      v === undefined ? fallback : v ? '1' : '0';
    const payload: Record<string, string> = {
      ...current,
      site_name: settings.title ?? current.site_name,
      site_description: settings.subtitle ?? current.site_description,
      site_url: settings.siteUrl ?? current.site_url,
      default_theme: settings.defaultTheme ?? current.default_theme,
      author: settings.author ?? current.author,
      avatar: settings.avatar ?? current.avatar,
      cos_secret_id: settings.apiKey ?? current.cos_secret_id,
      cos_bucket: settings.cosBucket ?? current.cos_bucket,
      cos_region: settings.cosRegion ?? current.cos_region,
      storage_provider: settings.storageProvider ?? current.storage_provider,
      turnstile_site_key: settings.turnstileSiteKey ?? current.turnstile_site_key,
      friend_link_enabled: boolStr(settings.friendLinkEnabled, current.friend_link_enabled),
      github_enabled: boolStr(settings.githubEnabled, current.github_enabled),
      github_username: settings.githubUsername ?? current.github_username,
      nav_menu_normal: settings.navMenuNormal ?? current.nav_menu_normal,
      nav_menu_reader: settings.navMenuReader ?? current.nav_menu_reader,
      about_content: settings.aboutContent ?? current.about_content,
      about_blocks: settings.aboutBlocks ?? current.about_blocks,
      douban_uid: settings.doubanUserId ?? current.douban_uid,
      douban_enabled: boolStr(settings.doubanSyncEnabled, current.douban_enabled),
      douban_last_sync: settings.lastDoubanSync ?? current.douban_last_sync,
      netease_cookie: settings.neteaseCookie ?? current.netease_cookie,
      netease_playlist_id: settings.neteasePlaylistId ?? current.netease_playlist_id
    };
    // 掩码占位：'********' 或留空 = 保持已存密钥不变
    for (const key of ['cos_secret_key', 'tmdb_api_key', 'turnstile_secret_key', 'netease_cookie'] as const) {
      const v = settings[key === 'cos_secret_key' ? 'apiSecret' : key === 'tmdb_api_key' ? 'doubanApiKey' : key === 'turnstile_secret_key' ? 'turnstileSecretKey' : 'neteaseCookie'];
      if (v === undefined) continue;
      if (!v || v === '********') delete payload[key];
      else payload[key] = v;
    }
    await request<Record<string, string>>('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    return api.getSettings();
  },

  /** 修改密码：旧密码错误时后端返回 401 + INVALID_PASSWORD，不会触发强制登出 */
  async changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
    await request<{ message: string }>('/admin/password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword })
    });
    return true;
  },

  async triggerDoubanSync(): Promise<string> {
    const r = await request<{ count: number }>('/admin/douban/sync', { method: 'POST' });
    return `已同步 ${r.count} 部，缓存已预热`;
  },

  // ---------- 主题配置 ----------
  /** 读取主题 JSON（容错） */
  async getThemeConfig(): Promise<ThemeConfig> {
    const s = await request<Record<string, string>>('/admin/settings');
    const parseTheme = (raw: string | undefined): Record<string, unknown> => {
      try {
        const o = JSON.parse(raw || '{}');
        return o && typeof o === 'object' ? o : {};
      } catch {
        return {};
      }
    };
    const normal = parseTheme(s.theme_normal);
    const reader = parseTheme(s.theme_reader);
    const toColors = (t: Record<string, unknown>, fallback: ThemeColors): ThemeColors => ({
      bg: typeof t.bg === 'string' && t.bg ? t.bg : fallback.bg,
      text: typeof t.text === 'string' && t.text ? t.text : fallback.text,
      muted: typeof t.muted === 'string' && t.muted ? t.muted : fallback.muted,
      primary: typeof t.primary === 'string' && t.primary ? t.primary : fallback.primary,
      border: typeof t.border === 'string' && t.border ? t.border : fallback.border,
      avatar: typeof t.avatar === 'string' ? t.avatar : fallback.avatar,
      intro: typeof t.intro === 'string' ? t.intro : fallback.intro
    });
    return {
      layoutMode: (normal.active ?? 'normal') as 'normal' | 'reader',
      colorPalette: 'amber',
      fontSize: typeof normal.fontSize === 'number' ? normal.fontSize : 16,
      postsPerPage: typeof normal.homePageSize === 'number' ? normal.homePageSize : 10,
      colors: {
        normal: toColors(normal, {
          bg: '#09090b', text: '#f4f4f5', muted: '#9d9d95', primary: '#e8b64c',
          border: '#26262a', avatar: '', intro: '一个喜欢折腾代码和生活的博主'
        }),
        reader: toColors(reader, {
          bg: '#f3f0e9', text: '#3a3837', muted: '#b0aba4', primary: '#8b3525',
          border: '#e5e1da', avatar: '', intro: '一个喜欢折腾代码和生活的博主'
        })
      }
    };
  },

  async updateThemeConfig(config: Partial<ThemeConfig>): Promise<ThemeConfig> {
    const s = await request<Record<string, string>>('/admin/settings');
    const parseTheme = (raw: string | undefined): Record<string, unknown> => {
      try {
        const o = JSON.parse(raw || '{}');
        return o && typeof o === 'object' ? o : {};
      } catch {
        return {};
      }
    };
    // 分别更新 normal / reader 两套主题（layoutMode 指定要改哪套）
    const targetKey = config.layoutMode === 'reader' ? 'theme_reader' : 'theme_normal';
    const target = parseTheme(s[targetKey]);
    const merged: Record<string, unknown> = {
      ...target,
      active: config.layoutMode ?? target.active ?? 'normal',
      fontSize: config.fontSize ?? target.fontSize,
      homePageSize: config.postsPerPage ?? target.homePageSize
    };
    const colors = config.colors?.[config.layoutMode === 'reader' ? 'reader' : 'normal'];
    if (colors) {
      for (const k of ['bg', 'text', 'muted', 'primary', 'border', 'avatar', 'intro'] as const) {
        if (colors[k] !== undefined) merged[k] = colors[k];
      }
    }
    const payload: Record<string, string> = {
      ...s,
      [targetKey]: JSON.stringify(merged)
    };
    await request<Record<string, string>>('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    return api.getThemeConfig();
  }
};
