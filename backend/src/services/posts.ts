import { eq } from 'drizzle-orm';
import { posts, postTags } from '../db/schema';
import { renderMarkdown } from './markdown';
import { makeSlug } from '../lib/slug';
import type { Db } from '../db';

export interface PostInput {
  title: string;
  slug?: string;
  contentMd: string;
  summary?: string;
  cover?: string;
  categoryId?: number | null;
  status?: 'draft' | 'published';
  tagIds?: number[];
}

/**
 * CJK 逐字分词：unicode61 分词器把连续中文当作单个 token，导致"正文"搜不到"正文内容"。
 * 这里把每个 CJK 字符用空格隔开（英文单词不受影响），配合查询端同样处理实现中文子串搜索。
 */
export function toSearchText(text: string): string {
  return text.replace(/([\u4e00-\u9fa5])/g, '$1 ');
}

export function syncFts(ctx: Db, post: { id: number; title: string; contentMd: string }): void {
  ctx.sqlite.prepare('DELETE FROM posts_fts WHERE rowid = ?').run(post.id);
  ctx.sqlite
    .prepare('INSERT INTO posts_fts(rowid, title, content_md) VALUES (?, ?, ?)')
    .run(post.id, toSearchText(post.title), toSearchText(post.contentMd));
}

export function setPostTags(ctx: Db, postId: number, tagIds: number[]): void {
  ctx.db.delete(postTags).where(eq(postTags.postId, postId)).run();
  for (const tagId of tagIds) {
    ctx.db.insert(postTags).values({ postId, tagId }).run();
  }
}

export async function createPost(ctx: Db, input: PostInput): Promise<number> {
  const slug = input.slug?.trim() || makeSlug(input.title);
  const contentHtml = await renderMarkdown(input.contentMd || '');
  const summary = input.summary?.trim() || input.contentMd.slice(0, 150);
  // posts 行 + FTS + post_tags 三处写入放在同一事务，失败时整体回滚
  return ctx.sqlite.transaction(() => {
    const row = ctx.db.insert(posts).values({
      title: input.title,
      slug,
      contentMd: input.contentMd,
      contentHtml,
      summary,
      cover: input.cover ?? '',
      categoryId: input.categoryId ?? null,
      status: input.status ?? 'draft',
    }).returning({ id: posts.id }).get();
    syncFts(ctx, { id: row.id, title: input.title, contentMd: input.contentMd });
    setPostTags(ctx, row.id, input.tagIds ?? []);
    return row.id;
  })();
}

export async function updatePost(ctx: Db, id: number, input: PostInput): Promise<void> {
  const existing = ctx.db.select().from(posts).where(eq(posts.id, id)).get();
  if (!existing) throw new Error('NOT_FOUND');
  const slug = input.slug?.trim() || existing.slug;
  const contentHtml = await renderMarkdown(input.contentMd ?? '');
  // 更新 + FTS 重建 + post_tags 重写放在同一事务
  ctx.sqlite.transaction(() => {
    ctx.db.update(posts).set({
      title: input.title,
      slug,
      contentMd: input.contentMd,
      contentHtml,
      summary: input.summary?.trim() || input.contentMd.slice(0, 150),
      cover: input.cover ?? '',
      categoryId: input.categoryId ?? null,
      status: input.status ?? existing.status,
      updatedAt: Date.now(),
    }).where(eq(posts.id, id)).run();
    syncFts(ctx, { id, title: input.title, contentMd: input.contentMd });
    setPostTags(ctx, id, input.tagIds ?? []);
  })();
}

export function deletePost(ctx: Db, id: number): void {
  ctx.sqlite.transaction(() => {
    ctx.sqlite.prepare('DELETE FROM posts_fts WHERE rowid = ?').run(id);
    ctx.db.delete(postTags).where(eq(postTags.postId, id)).run();
    ctx.db.delete(posts).where(eq(posts.id, id)).run();
  })();
}
