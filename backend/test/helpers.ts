import { createApp } from '../src/app';
import { createDb } from '../src/db';
import { ensureMigrated } from '../src/db/migrate';

export function makeTestApp() {
  const ctx = createDb(':memory:');
  ensureMigrated(ctx);
  const app = createApp(ctx);
  return { app, ctx };
}
