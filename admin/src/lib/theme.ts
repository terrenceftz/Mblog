export type ThemeMode = 'light' | 'dark' | 'system';

// 与前台主题键隔离：前台 mblog_theme 存 normal/reader（双主题），后台存 light/dark/system。
// 共用同一 key 会互相污染——后台每次加载写入 system 后，前台 ThemeToggle 直接套用会把
// data-theme 污染成 'system'，导致前台双主题 CSS 与 LiquidEther 特效全部失效。
const THEME_KEY = 'mblog_admin_theme';
/** 旧后台主题键（一次性迁移用） */
const LEGACY_THEME_KEYS = ['mblog_theme', 'admin_theme'];

/**
 * 读取主题设置（默认 system 跟随系统）。
 * 兼容旧键：首次读取到 mblog_theme(light/dark/system) / admin_theme(dark/light/auto) 时
 * 迁移到 mblog_admin_theme 并删除旧键。
 */
export function getThemeMode(): ThemeMode {
  const saved = localStorage.getItem(THEME_KEY) as ThemeMode | null;
  if (saved === 'light' || saved === 'dark' || saved === 'system') {
    return saved;
  }
  // 旧键迁移：仅当旧键存的是后台主题值（light/dark/system/auto）时迁移并删除，
  // 避免误删前台写入 mblog_theme 的 normal/reader（值不匹配直接跳过）
  for (const key of LEGACY_THEME_KEYS) {
    const legacy = localStorage.getItem(key);
    const norm = legacy === 'auto' ? 'system' : legacy;
    if (norm === 'light' || norm === 'dark' || norm === 'system') {
      localStorage.setItem(THEME_KEY, norm);
      localStorage.removeItem(key);
      return norm;
    }
  }
  return 'system';
}

/**
 * 应用主题到 <html>：data-theme（自定义 CSS）+ data-bs-theme（Bootstrap/Tabler 暗色）
 */
export function applyTheme(mode: ThemeMode): void {
  localStorage.setItem(THEME_KEY, mode);

  let targetTheme: 'light' | 'dark' = 'light';

  if (mode === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    targetTheme = prefersDark ? 'dark' : 'light';
  } else {
    targetTheme = mode;
  }

  const html = document.documentElement;
  html.setAttribute('data-theme', targetTheme);
  html.setAttribute('data-bs-theme', targetTheme);
}

/**
 * 初始化主题监听：立即应用一次，system 模式下跟随系统变化
 */
export function initTheme(): ThemeMode {
  const mode = getThemeMode();
  applyTheme(mode);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getThemeMode() === 'system') {
      applyTheme('system');
    }
  });

  return mode;
}
