import { Hono } from 'hono';
import { eq, desc, count } from 'drizzle-orm';
import { photos } from '../../db/schema';
import type { Db } from '../../db';

// 绝对 http(s) 或站内相对路径（/uploads/...，本地上传返回的相对地址）
const URL_RE = /^(https?:\/\/|\/)/i;

export function photosAdminRoutes(ctx: Db) {
  const app = new Hono();

  // 相册列表（分页，sortOrder 大在前 + 新上传在前）
  app.get('/photos', (c) => {
    const total = ctx.db.select({ n: count() }).from(photos).get()?.n ?? 0;
    const rawPage = Number(c.req.query('page') ?? 1);
    const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
    const rawSize = Number(c.req.query('pageSize') ?? 50);
    const pageSize = Number.isInteger(rawSize) && rawSize >= 1 ? Math.min(100, rawSize) : 50;
    const rows = ctx.db
      .select()
      .from(photos)
      .orderBy(desc(photos.sortOrder), desc(photos.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .all();
    return c.json({ data: { list: rows, total } });
  });

  // 新增照片（本地上传得 url 后提交，或直接填外部图片地址）
  app.post('/photos', async (c) => {
    const body = await c.req.json().catch(() => null);
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!url || !URL_RE.test(url)) {
      return c.json({ error: { code: 'INVALID', message: '图片地址需以 http(s):// 开头' } }, 400);
    }
    const row = ctx.db
      .insert(photos)
      .values({
        url,
        title: typeof body?.title === 'string' ? body.title.trim().slice(0, 100) : '',
        description: typeof body?.description === 'string' ? body.description.trim().slice(0, 500) : '',
        album: typeof body?.album === 'string' ? body.album.trim().slice(0, 50) : '',
        // EXIF 摘要 JSON（上传端解析后传入；长度护栏防异常大对象）
        exif: typeof body?.exif === 'string' ? body.exif.slice(0, 2000) : '',
        sortOrder: Number.isInteger(body?.sortOrder) ? (body.sortOrder as number) : 0,
      })
      .returning()
      .get();
    return c.json({ data: row }, 201);
  });

  // 更新照片（标题/描述/地址/排序）
  app.patch('/photos/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const row = ctx.db.select().from(photos).where(eq(photos.id, id)).get();
    if (!row) return c.json({ error: { code: 'NOT_FOUND', message: '照片不存在' } }, 404);
    const body = await c.req.json().catch(() => null);
    const patch: Record<string, unknown> = {};
    if (typeof body?.title === 'string') patch.title = body.title.trim().slice(0, 100);
    if (typeof body?.description === 'string') patch.description = body.description.trim().slice(0, 500);
    if (typeof body?.url === 'string' && URL_RE.test(body.url.trim())) patch.url = body.url.trim();
    if (typeof body?.album === 'string') patch.album = body.album.trim().slice(0, 50);
    if (Number.isInteger(body?.sortOrder)) patch.sortOrder = body.sortOrder as number;
    if (Object.keys(patch).length) {
      ctx.db.update(photos).set(patch).where(eq(photos.id, id)).run();
    }
    const updated = ctx.db.select().from(photos).where(eq(photos.id, id)).get();
    return c.json({ data: updated });
  });

  app.delete('/photos/:id', (c) => {
    const id = Number(c.req.param('id'));
    ctx.db.delete(photos).where(eq(photos.id, id)).run();
    return c.json({ data: { ok: true } });
  });

  return app;
}
