import { eq } from 'drizzle-orm';
import { settings } from '../db/schema';
import type { Db } from '../db';

export const DEFAULT_SETTINGS: Record<string, string> = {
  site_name: '我的博客',
  site_description: '',
  site_url: 'http://localhost',
  default_theme: 'normal',
  friend_link_enabled: '1',
  storage_provider: 'local',
  cos_secret_id: '',
  cos_secret_key: '',
  cos_bucket: '',
  cos_region: '',
  // 前台导航菜单：JSON 数组 [{label, url}]，后台可自定义
  nav_menu: JSON.stringify([
    { label: '首页', url: '/' },
    { label: '归档', url: '/archive' },
    { label: '友链', url: '/friends' },
    { label: '项目', url: '/projects' },
    { label: '影音', url: '/douban' },
    { label: 'RSS', url: '/api/rss' },
  ]),
  // 主题配置（JSON，空串 = 使用 CSS 内置默认）
  theme_normal: '',
  theme_reader: '',
  // GitHub 项目展示
  github_enabled: '0',
  github_username: '',
  // 豆瓣影音展示
  douban_enabled: '0',
  douban_uid: '',
};

export function getSetting(ctx: Db, key: string): string {
  const row = ctx.db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).get();
  return row?.value ?? DEFAULT_SETTINGS[key] ?? '';
}

export function getSettings(ctx: Db, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = getSetting(ctx, k);
  return out;
}

export function setSetting(ctx: Db, key: string, value: string): void {
  ctx.db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}
