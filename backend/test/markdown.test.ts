import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../src/services/markdown';

describe('renderMarkdown', () => {
  it('渲染标题与代码高亮', async () => {
    const html = await renderMarkdown('# Hello\n\n```js\nconst a = 1;\n```');
    expect(html).toContain('<h1>Hello</h1>');
    expect(html).toContain('hljs');
  });

  it('允许音频标签', async () => {
    const html = await renderMarkdown('<audio controls src="/uploads/a.mp3"></audio>');
    expect(html).toContain('<audio controls');
    expect(html).toContain('/uploads/a.mp3');
  });

  it('剥离 script 脚本（防 XSS）', async () => {
    const html = await renderMarkdown('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
  });

  it('支持 GFM 表格', async () => {
    const html = await renderMarkdown('| a | b |\n| - | - |\n| 1 | 2 |');
    expect(html).toContain('<table>');
  });
});
