export interface ThemeConfig {
  bg?: string;
  text?: string;
  muted?: string;
  primary?: string;
  border?: string;
  fontSize?: number;
  homePageSize?: number;
  /** 头像图 URL（正常主题首屏） */
  avatar?: string;
  /** 自我介绍文字（正常主题首屏，BlurText 动效） */
  intro?: string;
}

const COLOR_KEYS = ['bg', 'text', 'muted', 'primary', 'border'] as const;

// 解析主题配置 JSON；非法 JSON 或非法值一律丢弃，返回空对象（回退 CSS 默认）
export function parseThemeConfig(raw: string): ThemeConfig {
  if (!raw) return {};
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const o = obj as Record<string, unknown>;
  const out: ThemeConfig = {};
  for (const k of COLOR_KEYS) {
    if (typeof o[k] === 'string' && (o[k] as string).trim()) out[k] = o[k] as string;
  }
  if (Number.isInteger(o.fontSize) && (o.fontSize as number) >= 12 && (o.fontSize as number) <= 24) {
    out.fontSize = o.fontSize as number;
  }
  if (Number.isInteger(o.homePageSize) && (o.homePageSize as number) >= 1 && (o.homePageSize as number) <= 50) {
    out.homePageSize = o.homePageSize as number;
  }
  if (typeof o.avatar === 'string' && (o.avatar as string).trim()) {
    out.avatar = (o.avatar as string).trim();
  }
  if (typeof o.intro === 'string' && (o.intro as string).trim()) {
    out.intro = (o.intro as string).trim();
  }
  return out;
}
