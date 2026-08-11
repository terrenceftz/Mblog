/**
 * 后台主题管理：dark / light / auto 三态
 * - 默认 auto：跟随系统 prefers-color-scheme
 * - 用户选择写入 localStorage('admin_theme')，跨会话保留
 * - 实际生效值通过 <html data-theme="dark|light"> 反映
 *
 * 注意：auto 模式下 data-theme 仍会被解析为具体的 dark/light，
 * 这样 CSS 只需匹配 [data-theme="light"] 即可，无需关心 auto。
 */

export type ThemeChoice = 'dark' | 'light' | 'auto';
export type ResolvedTheme = 'dark' | 'light';

const STORAGE_KEY = 'admin_theme';
const MEDIA = window.matchMedia('(prefers-color-scheme: dark)');

/** 读取用户选择（默认 auto） */
export function getThemeChoice(): ThemeChoice {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'dark' || v === 'light' ? v : 'auto';
}

/** 把选择解析成实际生效的 dark/light */
export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice === 'auto') return MEDIA.matches ? 'dark' : 'light';
  return choice;
}

/** 当前实际生效主题 */
export function getResolvedTheme(): ResolvedTheme {
  return resolveTheme(getThemeChoice());
}

/** 应用主题到 <html data-theme> */
export function applyTheme(choice: ThemeChoice): ResolvedTheme {
  const resolved = resolveTheme(choice);
  document.documentElement.setAttribute('data-theme', resolved);
  return resolved;
}

/** 持久化用户选择并应用 */
export function setThemeChoice(choice: ThemeChoice): ResolvedTheme {
  localStorage.setItem(STORAGE_KEY, choice);
  return applyTheme(choice);
}

/**
 * 启动主题系统：
 * 1. 立即应用一次（main.ts 中调用，确保首屏正确）
 * 2. 监听系统主题变化——仅当用户选择为 auto 时跟随
 * @returns 取消监听的函数
 */
export function startThemeSystem(): () => void {
  applyTheme(getThemeChoice());
  const handler = (e: MediaQueryListEvent) => {
    if (getThemeChoice() === 'auto') {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    }
  };
  MEDIA.addEventListener('change', handler);
  return () => MEDIA.removeEventListener('change', handler);
}

/**
 * 首屏防闪白：在 Vue 挂载前同步执行（main.ts 顶部）。
 * 直接内联同款逻辑也可，但抽出便于测试。
 */
export function initThemeEarly(): void {
  applyTheme(getThemeChoice());
}
