import { Hono } from 'hono';
import { eq, desc, count } from 'drizzle-orm';
import { mediaFiles, posts, comments } from '../../db/schema';
import { getStorage } from '../../storage';
import type { Db } from '../../db';

const MAX_SIZES: Record<string, number> = {
  'image/png': 10 * 1024 * 1024,
  'image/jpeg': 10 * 1024 * 1024,
  'image/gif': 10 * 1024 * 1024,
  'image/webp': 10 * 1024 * 1024,
  'image/svg+xml': 1 * 1024 * 1024,
  'audio/mpeg': 50 * 1024 * 1024,
  'audio/ogg': 50 * 1024 * 1024,
  'audio/wav': 50 * 1024 * 1024,
  'audio/mp4': 50 * 1024 * 1024,
};

export function uploadAdminRoutes(ctx: Db) {
  const app = new Hono();

  app.post('/upload', async (c) => {
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) {
      return c.json({ error: { code: 'INVALID', message: '缺少文件（字段名 file）' } }, 400);
    }
    const maxSize = MAX_SIZES[file.type];
    if (!maxSize) return c.json({ error: { code: 'INVALID', message: `不支持的文件类型: ${file.type}` } }, 400);
    if (file.size > maxSize) return c.json({ error: { code: 'INVALID', message: '文件过大' } }, 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const storage = getStorage(ctx);
    const result = await storage.upload({ filename: file.name, mime: file.type, buffer });
    ctx.db.insert(mediaFiles).values({
      filename: file.name, url: result.url, key: result.key,
      size: file.size, mime: file.type, storage: storage.type,
    }).run();
    return c.json({ data: result }, 201);
  });

  app.get('/media', (c) => {
    // 分页参数加固：非法/小数一律回落默认值，防止 NaN 泄漏到 LIMIT/OFFSET
    const rawPage = Number(c.req.query('page') ?? 1);
    const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
    const rawSize = Number(c.req.query('pageSize') ?? 30);
    const pageSize = Number.isInteger(rawSize) && rawSize >= 1 ? Math.min(100, rawSize) : 30;
    const total = ctx.db.select({ n: count() }).from(mediaFiles).get()?.n ?? 0;
    const list = ctx.db.select().from(mediaFiles).orderBy(desc(mediaFiles.createdAt))
      .limit(pageSize).offset((page - 1) * pageSize).all();
    return c.json({ data: { list, total } });
  });

  app.delete('/media/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const row = ctx.db.select().from(mediaFiles).where(eq(mediaFiles.id, id)).get();
    if (!row) return c.json({ error: { code: 'NOT_FOUND', message: '文件不存在' } }, 404);
    await getStorage(ctx).delete(row.key).catch(() => {});
    ctx.db.delete(mediaFiles).where(eq(mediaFiles.id, id)).run();
    return c.json({ data: { ok: true } });
  });

  app.get('/stats', (c) => {
    const postTotal = ctx.db.select({ n: count() }).from(posts).get()?.n ?? 0;
    const published = ctx.db.select({ n: count() }).from(posts).where(eq(posts.status, 'published')).get()?.n ?? 0;
    const commentTotal = ctx.db.select({ n: count() }).from(comments).get()?.n ?? 0;
    const pendingComments = ctx.db.select({ n: count() }).from(comments).where(eq(comments.status, 'pending')).get()?.n ?? 0;
    const totalViews = ctx.db.select({ n: posts.viewCount }).from(posts).all().reduce((s, r) => s + r.n, 0);
    return c.json({ data: { postTotal, published, commentTotal, pendingComments, totalViews } });
  });

  return app;
}
