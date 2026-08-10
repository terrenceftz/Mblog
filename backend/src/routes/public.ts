import { Hono } from 'hono';
import { postsRoutes } from './public/posts';
import { categoriesTagsRoutes } from './public/categoriesTags';
import { commentsRoutes } from './public/comments';
import { friendLinksRoutes } from './public/friendLinks';
import { miscRoutes } from './public/misc';
import { githubRoutes } from './public/github';
import { doubanRoutes } from './public/douban';
import type { Db } from '../db';

export function publicRoutes(ctx: Db) {
  const app = new Hono();
  app.route('/', postsRoutes(ctx));
  app.route('/', categoriesTagsRoutes(ctx));
  app.route('/', commentsRoutes(ctx));
  app.route('/', friendLinksRoutes(ctx));
  app.route('/', miscRoutes(ctx));
  app.route('/', githubRoutes(ctx));
  app.route('/', doubanRoutes(ctx));
  return app;
}
