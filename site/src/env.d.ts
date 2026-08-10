/// <reference types="astro/client" />

// @types/node 未安装，仅声明本项目用到的 process.env（Node 运行时）
declare const process: {
  env: Record<string, string | undefined>;
};
