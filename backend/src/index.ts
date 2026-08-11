import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { createDb } from './db';
import { ensureMigrated } from './db/migrate';
import { getSecret } from './lib/jwt';

// 启动即校验 JWT 密钥，配置缺失时 fail-fast 拒绝启动
getSecret();

const dbPath = process.env.DB_PATH ?? 'data/mblog.db';
// better-sqlite3 不会自动创建父目录
mkdirSync(path.dirname(dbPath), { recursive: true });
const ctx = createDb(dbPath);
ensureMigrated(ctx);

const app = createApp(ctx);
const port = Number(process.env.PORT ?? 3000);

console.log(`[server] http://localhost:${port}`);
serve({ fetch: app.fetch, port });
