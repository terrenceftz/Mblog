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
  description: string;
  keywords: string;
  author: string;
  avatar: string;
  icp: string;
  apiKey: string;
  apiSecret: string;
  doubanUserId: string;
  doubanApiKey: string;
  doubanSyncEnabled: boolean;
  lastDoubanSync?: string;
}

export interface ThemeConfig {
  layoutMode: 'normal' | 'reader';
  colorPalette: 'amber' | 'blue' | 'emerald' | 'purple';
  fontSize: number;
  postsPerPage: number;
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
      postCount: c.postCount
    }));
  },

  async saveCategory(cat: Partial<Category>): Promise<Category> {
    if (cat.id) {
      await request<{ id: number }>(`/admin/categories/${cat.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: cat.name })
      });
      return {
        id: cat.id,
        name: cat.name || '',
        slug: cat.slug || '',
        description: '',
        postCount: cat.postCount || 0
      };
    }
    const row = await request<CategoryRow>('/admin/categories', {
      method: 'POST',
      body: JSON.stringify({ name: cat.name, slug: cat.slug })
    });
    return { id: row.id, name: row.name, slug: row.slug, description: '', postCount: row.postCount };
  },

  async deleteCategory(id: number): Promise<boolean> {
    await request<{ ok: true }>(`/admin/categories/${id}`, { method: 'DELETE' });
    return true;
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
    // 后端无 DELETE /talks 接口，删除能力由页面层移除（见 TalkManager 适配）
    return false;
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
    // 后端无 POST /friend-links（友链由前台访客申请），后台仅可审核
    if (!link.id) throw new ApiError(400, '友链由前台访客申请，后台仅可审核');
    await request<{ id: number }>(`/admin/friend-links/${link.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: link.status })
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
      description: s.site_description || '',
      keywords: '',
      author: '',
      avatar: '',
      icp: '',
      apiKey: s.cos_secret_id || '',
      apiSecret: s.cos_secret_key || '',
      doubanUserId: s.douban_uid || '',
      doubanApiKey: s.tmdb_api_key || '',
      doubanSyncEnabled: s.douban_enabled === '1',
      lastDoubanSync: ''
    };
  },

  async updateSettings(settings: Partial<SiteSettings>): Promise<SiteSettings> {
    const current = await request<Record<string, string>>('/admin/settings');
    const payload: Record<string, string> = {
      ...current,
      site_name: settings.title ?? current.site_name,
      site_description: settings.subtitle ?? current.site_description,
      cos_secret_id: settings.apiKey ?? current.cos_secret_id,
      douban_uid: settings.doubanUserId ?? current.douban_uid,
      tmdb_api_key: settings.doubanApiKey ?? current.tmdb_api_key,
      douban_enabled:
        settings.doubanSyncEnabled === undefined
          ? current.douban_enabled
          : settings.doubanSyncEnabled
            ? '1'
            : '0'
    };
    // 掩码占位：'********' 或留空 = 保持已存密钥不变
    for (const key of ['cos_secret_key', 'tmdb_api_key', 'turnstile_secret_key'] as const) {
      const v = payload[key];
      if (!v || v === '********') delete payload[key];
    }
    await request<Record<string, string>>('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    return api.getSettings();
  },

  async triggerDoubanSync(): Promise<string> {
    const r = await request<{ count: number }>('/admin/douban/sync', { method: 'POST' });
    return `已同步 ${r.count} 部，缓存已预热`;
  },

  // ---------- 主题配置 ----------
  async getThemeConfig(): Promise<ThemeConfig> {
    const s = await request<Record<string, string>>('/admin/settings');
    let normal: Record<string, unknown> = {};
    try {
      normal = JSON.parse(s.theme_normal || '{}');
    } catch {
      normal = {};
    }
    return {
      layoutMode: (normal.active ?? 'normal') as 'normal' | 'reader',
      colorPalette: 'amber',
      fontSize: typeof normal.fontSize === 'number' ? normal.fontSize : 16,
      postsPerPage: typeof normal.homePageSize === 'number' ? normal.homePageSize : 10
    };
  },

  async updateThemeConfig(config: Partial<ThemeConfig>): Promise<ThemeConfig> {
    const s = await request<Record<string, string>>('/admin/settings');
    const themeKey = config.layoutMode === 'reader' ? 'theme_reader' : 'theme_normal';
    let theme: Record<string, unknown> = {};
    try {
      theme = JSON.parse(s[themeKey] || '{}');
    } catch {
      theme = {};
    }
    theme = {
      ...theme,
      fontSize: config.fontSize ?? theme.fontSize,
      homePageSize: config.postsPerPage ?? theme.homePageSize
    };
    const payload: Record<string, string> = {
      ...s,
      theme_normal: JSON.stringify(theme),
      theme_reader: JSON.stringify(theme)
    };
    await request<Record<string, string>>('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    return api.getThemeConfig();
  }
};
