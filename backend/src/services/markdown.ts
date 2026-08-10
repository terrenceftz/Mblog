import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';

// 在默认白名单上扩展音频/视频标签，支持编辑器插入的 <audio>
const schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'audio', 'video', 'figure', 'figcaption'],
  attributes: {
    ...defaultSchema.attributes,
    audio: [...(defaultSchema.attributes?.audio ?? []), 'src', 'controls', 'preload', 'loop'],
    source: [...(defaultSchema.attributes?.source ?? []), 'src', 'type'],
    video: [...(defaultSchema.attributes?.video ?? []), 'src', 'controls', 'poster'],
  },
  protocols: {
    ...defaultSchema.protocols,
    poster: ['http', 'https'],
  },
};

export async function renderMarkdown(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, schema)
    .use(rehypeHighlight)
    .use(rehypeStringify)
    .process(md);
  return String(file);
}
