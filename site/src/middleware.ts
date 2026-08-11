import { defineMiddleware } from 'astro:middleware';
import { getPublicSettings } from './lib/api';

// Astro 5 中间件：每请求只拉取一次公共设置，经 Astro.locals.settings 共享给各页面/布局
export const onRequest = defineMiddleware(async (context, next) => {
  try {
    const settings = await getPublicSettings();
    context.locals.settings = settings;
  } catch {
    // fallback：保持 locals.settings 未定义，调用方沿用原有兜底
  }
  return next();
});
