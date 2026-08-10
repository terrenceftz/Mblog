import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { createDb } from './db';
import { ensureMigrated } from './db/migrate';

const dbPath = process.env.DB_PATH ?? 'data/mblog.db';
// better-sqlite3 不会自动创建父目录
mkdirSync(path.dirname(dbPath), { recursive: true });
const ctx = createDb(dbPath);
ensureMigrated(ctx);

const app = createApp(ctx);
const port = Number(process.env.PORT ?? 3000);

console.log(`[server] http://localhost:${port}`);
serve({ fetch: app.fetch, port });
