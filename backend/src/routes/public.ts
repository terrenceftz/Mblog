import { Hono } from 'hono';
import { postsRoutes } from './public/posts';
import type { Db } from '../db';

export function publicRoutes(ctx: Db) {
  const app = new Hono();
  app.route('/', postsRoutes(ctx));
  return app;
}
