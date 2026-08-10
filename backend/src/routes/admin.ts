import { Hono } from 'hono';
import type { Db } from '../db';

export function adminRoutes(ctx: Db) {
  const app = new Hono();
  return app;
}
