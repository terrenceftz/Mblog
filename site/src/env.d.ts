/// <reference types="astro/client" />

// @types/node 未安装，仅声明本项目用到的 process.env（Node 运行时）
declare const process: {
  env: Record<string, string | undefined>;
};

// middleware 共享的公共设置（每请求拉取一次，BaseLayout/index 通过 Astro.locals 复用）
declare namespace App {
  interface Locals {
    settings?: import('./lib/api').PublicSettings;
  }
}
