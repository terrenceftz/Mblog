export interface TocItem {
  id: string;
  level: number;
  text: string;
}

// 从后端渲染的 contentHtml 中提取 h2/h3，注入锚点 id，返回带 id 的 HTML 与目录
export function withTocIds(html: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  let n = 0;
  const out = html.replace(/<h([23])([^>]*)>(.*?)<\/h\1>/g, (_m, level: string, attrs: string, inner: string) => {
    n += 1;
    const id = `sec-${n}`;
    const text = inner.replace(/<[^>]*>/g, '').trim();
    toc.push({ id, level: Number(level), text });
    const a = attrs.trim();
    return `<h${level} id="${id}"${a ? ' ' + a : ''}>${inner}</h${level}>`;
  });
  return { html: out, toc };
}
