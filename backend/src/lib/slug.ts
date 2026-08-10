import slugify from 'slugify';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);

/** 由标题生成 slug；中文标题无 ASCII 结果时回退为 post-<random>。 */
export function makeSlug(title: string): string {
  const s = slugify(title, { lower: true, strict: true, trim: true });
  return s || `post-${nanoid()}`;
}
