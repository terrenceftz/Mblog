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
