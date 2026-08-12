// 代码块增强：为正文 .article-content 内每个 pre 注入语言标签 + 复制按钮。
// 语言取自 highlight.js 给 <code> 加的 language-xxx class；clipboard API 复制并反馈。
const pres = document.querySelectorAll<HTMLElement>('.article-content pre');
pres.forEach((pre) => {
  if (pre.querySelector('.code-copy-btn')) return; // 已处理（防重复）
  const code = pre.querySelector('code');
  if (!code) return;
  // 语言标签
  const m = code.className.match(/language-([\w-]+)/);
  if (m) pre.setAttribute('data-lang', m[1]);
  // 复制按钮
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'code-copy-btn';
  btn.setAttribute('aria-label', '复制代码');
  btn.textContent = '复制';
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code.textContent || '');
      btn.textContent = '已复制';
      btn.classList.add('copied');
      window.setTimeout(() => {
        btn.textContent = '复制';
        btn.classList.remove('copied');
      }, 1500);
    } catch {
      /* clipboard 不可用时静默忽略 */
    }
  });
  pre.appendChild(btn);
});
