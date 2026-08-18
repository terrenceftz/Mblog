import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import vue from '@astrojs/vue';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [vue()],
  server: { port: 4321 },
  // 响应式图片：sharp 服务 + 远程域名白名单（astro 的 hostname 通配只支持前缀，故按真实图源枚举）。
  // 站点图（/uploads 反代、/api/cover 代理）经「请求源」拼绝对 URL，hostname 即部署域名；
  // 外部图源：豆瓣 img*.doubanio.com、TMDB image.tmdb.org、网易云 p*.music.126.net。
  // 未来换域名/加图源：在构建环境设 IMAGE_HOSTS=host1,host2 扩展，勿全量放开（SSRF 面）。
  image: {
    service: { entrypoint: 'astro/assets/services/sharp' },
    remotePatterns: [
      { hostname: 'localhost' },
      { hostname: '127.0.0.1' },
      { hostname: 'cs.mboker.cn' },
      { hostname: '**.doubanio.com' },
      { hostname: 'image.tmdb.org' },
      { hostname: '**.music.126.net' },
      ...(process.env.IMAGE_HOSTS
        ? process.env.IMAGE_HOSTS.split(',').map((h) => h.trim()).filter(Boolean).map((hostname) => ({ hostname }))
        : []),
    ],
  },
  // 开发环境：把 /api 与 /uploads 代理到本地 Hono 后端
  vite: {
    server: {
      proxy: {
        '/api': 'http://localhost:3000',
        '/uploads': 'http://localhost:3000',
      },
    },
  },
});
