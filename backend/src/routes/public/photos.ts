import { Hono } from 'hono';
import { desc } from 'drizzle-orm';
import { photos } from '../../db/schema';
import type { Db } from '../../db';

export function photosRoutes(ctx: Db) {
  const app = new Hono();

  // 相册（公开）：全部照片，sortOrder 大在前 + 新上传在前
  app.get('/photos', (c) => {
    const rows = ctx.db
      .select({
        id: photos.id,
        url: photos.url,
        title: photos.title,
        description: photos.description,
        album: photos.album,
      })
      .from(photos)
      .orderBy(desc(photos.sortOrder), desc(photos.createdAt))
      .all();
    return c.json({ data: rows });
  });

  return app;
}
