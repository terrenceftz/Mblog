import { AsyncLocalStorage } from 'node:async_hooks';

// 请求级上下文（仅服务端）：SSR 期间保存真实访客 IP。
// nginx 在 / 反代时注入 x-real-ip；middleware 里捕获，api.ts 的服务端 fetch
// 再透传给后端（阅读量去重 / 访问统计按真实 IP 生效，而非全部记成站点自己）。
// 注意：本模块只能被服务端代码动态 import（浏览器无 node:async_hooks）。
export const requestALS = new AsyncLocalStorage<{ ip?: string }>();
