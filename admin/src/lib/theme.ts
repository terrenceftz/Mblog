export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_KEY = 'mblog_theme';
/** 旧后台主题键（一次性迁移用） */
const LEGACY_THEME_KEY = 'admin_theme';

/**
 * 读取主题设置（默认 system 跟随系统）。
 * 兼容旧键：首次读取到 admin_theme 时迁移到 mblog_theme 并删除旧键。
 */
export function getThemeMode(): ThemeMode {
  const saved = localStorage.getItem(THEME_KEY) as ThemeMode | null;
  if (saved === 'light' || saved === 'dark' || saved === 'system') {
    return saved;
  }
  // 旧键迁移：admin_theme(dark/light/auto) → mblog_theme(light/dark/system)
  const legacy = localStorage.getItem(LEGACY_THEME_KEY);
  if (legacy === 'dark' || legacy === 'light') {
    localStorage.setItem(THEME_KEY, legacy);
    localStorage.removeItem(LEGACY_THEME_KEY);
    return legacy;
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
