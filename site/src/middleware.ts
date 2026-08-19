import { defineMiddleware } from 'astro:middleware';
import { getPublicSettings } from './lib/api';

// Astro 5 中间件：每请求只拉取一次公共设置，经 Astro.locals.settings 共享给各页面/布局。
// 同时用 AsyncLocalStorage 捕获 nginx 注入的 x-real-ip，供 api.ts 服务端 fetch 透传给后端
// （阅读量去重 / 访问统计按真实访客 IP 生效；ALS 需包裹 next() 才能传播到页面渲染）。
export const onRequest = defineMiddleware(async (context, next) => {
  const ip = context.request.headers.get('x-real-ip') ?? undefined;
  const { requestALS } = await import('./lib/requestContext');
  return requestALS.run({ ip }, async () => {
    try {
      const settings = await getPublicSettings();
      context.locals.settings = settings;
    } catch {
      // fallback：保持 locals.settings 未定义，调用方沿用原有兜底
    }
    return next();
  });
});
