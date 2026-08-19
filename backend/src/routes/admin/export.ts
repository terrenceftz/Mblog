import { Hono } from 'hono';
import archiver from 'archiver';
import { Readable } from 'node:stream';
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { posts, postTags, tags, categories, collections } from '../../db/schema';
import { getSetting } from '../../lib/settings';
import type { Db } from '../../db';

// 全量导出：posts/*.md（YAML frontmatter 元数据）+ manifest.json + uploads/（本地存储时）。
// zip 走流式（archiver → web stream），不在内存里攒整个包。

/** YAML 安全标量：含特殊字符的值整体加引号。 */
function yamlScalar(v: unknown): string {
  const s = String(v ?? '');
  return /^[\w\u4e00-\u9fa5 .:/-]*$/.test(s) && !s.includes(': ') ? s : JSON.stringify(s);
}

export function exportAdminRoutes(ctx: Db) {
  const app = new Hono();

  app.get('/export', (c) => {
    const rows = ctx.db
      .select({
        id: posts.id, title: posts.title, slug: posts.slug, summary: posts.summary, cover: posts.cover,
        contentMd: posts.contentMd, status: posts.status,
        categoryId: posts.categoryId, collectionId: posts.collectionId,
        createdAt: posts.createdAt, updatedAt: posts.updatedAt,
      })
      .from(posts)
      .all();

    // 标签/分类/合集映射（一次查询，循环内不查库）
    const tagRows = ctx.db
      .select({ postId: postTags.postId, name: tags.name })
      .from(postTags).innerJoin(tags, eq(postTags.tagId, tags.id)).all();
    const tagsByPost = new Map<number, string[]>();
    for (const t of tagRows) {
      const arr = tagsByPost.get(t.postId) ?? [];
      arr.push(t.name);
      tagsByPost.set(t.postId, arr);
    }
    const catById = new Map(ctx.db.select().from(categories).all().map((x) => [x.id, x.name]));
    const colById = new Map(ctx.db.select().from(collections).all().map((x) => [x.id, x.name]));

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('warning', () => { /* 单文件失败不中断整包 */ });
    archive.on('error', () => { /* 同上；流已开始的错误无法回传状态码 */ });

    for (const p of rows) {
      const fm = [
        '---',
        `title: ${yamlScalar(p.title)}`,
        `slug: ${yamlScalar(p.slug)}`,
        `date: ${new Date(p.createdAt).toISOString()}`,
        `updated: ${new Date(p.updatedAt).toISOString()}`,
        `status: ${p.status}`,
        p.categoryId ? `category: ${yamlScalar(catById.get(p.categoryId) ?? '')}` : null,
        p.collectionId ? `collection: ${yamlScalar(colById.get(p.collectionId) ?? '')}` : null,
        p.cover ? `cover: ${yamlScalar(p.cover)}` : null,
        (tagsByPost.get(p.id)?.length ?? 0) > 0 ? `tags: [${(tagsByPost.get(p.id) ?? []).map(yamlScalar).join(', ')}]` : null,
        p.summary ? `summary: ${yamlScalar(p.summary)}` : null,
        '---',
        '',
      ].filter((l): l is string => l !== null).join('\n');
      archive.append(fm + p.contentMd, { name: `posts/${p.slug}.md` });
    }

    const manifest = {
      exportedAt: new Date().toISOString(),
      siteName: getSetting(ctx, 'site_name'),
      siteUrl: getSetting(ctx, 'site_url'),
      postCount: rows.length,
      note: 'posts/ 为 Markdown+frontmatter 全文；uploads/ 为本地上传文件（COS 存储时请从 manifest.media 的 URL 自行下载）',
    };
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    // 本地存储时附带全部上传文件；COS 存储则记 URL 清单进 manifest
    const storageProvider = getSetting(ctx, 'storage_provider');
    const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? 'uploads');
    if (storageProvider !== 'cos' && existsSync(uploadDir)) {
      for (const f of readdirSync(uploadDir)) {
        const full = path.join(uploadDir, f);
        try {
          if (statSync(full).isFile()) archive.append(createReadStream(full), { name: `uploads/${f}` });
        } catch {
          /* 跳过不可读文件 */
        }
      }
    }

    archive.finalize();

    const stamp = new Date().toISOString().slice(0, 10);
    c.header('Content-Type', 'application/zip');
    c.header('Content-Disposition', `attachment; filename="mblog-export-${stamp}.zip"`);
    return c.body(Readable.toWeb(archive) as unknown as ReadableStream);
  });

  return app;
}
