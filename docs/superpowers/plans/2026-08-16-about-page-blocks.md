# About 页优化实施计划（结构化名片块）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** About 页升级为后台可编辑的结构化名片块（文本/键值/引用/进度/跑马灯），前台 editorial 视觉 + reveal 级联 + 统计 count-up，并修复 reader 主题视频背景布局损坏。

**Architecture:** settings 表新增 `about_blocks`（JSON 字符串，沿用 navMenu 模式，无新表）；admin SettingsPage 加块编辑器；site about.astro 按 `aboutBlocks` 结构化渲染、为空回退旧 `aboutContent` 分段。视频背景不做降级（用户决定）。

**Tech Stack:** backend Hono + Drizzle + vitest；admin Vue3 + Tabler；site Astro 5 + Vue islands。

**Spec:** `docs/superpowers/specs/2026-08-16-about-page-design.md`

**约定（重要）：**
- 全部 CSS 带 `[data-theme='normal']` / `[data-theme='reader']` 前缀
- 跨主题隐藏用主题 CSS 外部规则，禁组件 scoped `:global`
- Astro class/style 插值必须用模板字符串
- 工作流：直接提交 main；每 Task 一次 commit
- 初始基线：backend `npm test` 85/85

---

### Task 1: backend — about_blocks 白名单 + public 解析（TDD）

**Files:**
- Modify: `backend/src/lib/settings.ts`（DEFAULT_SETTINGS）
- Modify: `backend/src/routes/public/misc.ts`（/settings/public）
- Test: `backend/test/posts.test.ts`、`backend/test/admin.test.ts`

- [ ] **Step 1: 确认基线**

Run: `cd backend && npm test 2>&1 | tail -5`
Expected: 85 passed。

- [ ] **Step 2: 写失败测试（公开设置默认空数组）**

`backend/test/posts.test.ts` 第 113 行（`公开设置返回主题与站点名` 测试的 `});` 之后）插入：

```ts
  it('公开设置返回解析后的 aboutBlocks（默认空数组）', async () => {
    const res = await app.request('/api/settings/public');
    const body = await res.json();
    expect(Array.isArray(body.data.aboutBlocks)).toBe(true);
    expect(body.data.aboutBlocks.length).toBe(0);
  });
```

- [ ] **Step 3: 写失败测试（PUT 白名单往返 + 非法 type 过滤）**

`backend/test/admin.test.ts` 第 562 行（Turnstile 掩码往返测试的 `});` 之后、describe 结尾 `});` 之前）插入：

```ts
  it('about_blocks 白名单往返：PUT 保存后公开设置返回解析数组（非法 type 过滤）', async () => {
    const headers = authHeaders(token);
    const blocks = [
      { type: 'text', text: '你好，我是博主' },
      { type: 'kv', label: '性格', value: 'ENFP', link: 'https://www.16personalities.com/ch/enfp-人格' },
      { type: 'quote', text: '人生是旷野，不是轨道。', author: '梭罗' },
      { type: 'progress', title: '六年之约', start: '2024-12-31', end: '2030-12-31' },
      { type: 'marquee', text: 'KEEP GOING' },
      { type: 'hacker', payload: 'x' }, // 非法 type 应被过滤
    ];
    const put = await app.request('/api/admin/settings', {
      method: 'PUT',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ about_blocks: JSON.stringify(blocks) }),
    });
    expect(put.status).toBe(200);
    const pub = await app.request('/api/settings/public');
    const pubBody = await pub.json();
    expect(pubBody.data.aboutBlocks.length).toBe(5);
    expect(pubBody.data.aboutBlocks[1]).toEqual({
      type: 'kv', label: '性格', value: 'ENFP', link: 'https://www.16personalities.com/ch/enfp-人格',
    });
  });
```

- [ ] **Step 4: 跑测试确认失败**

Run: `cd backend && npx vitest run test/posts.test.ts test/admin.test.ts 2>&1 | tail -8`
Expected: FAIL —— `aboutBlocks` undefined（length 断言报错）。

- [ ] **Step 5: 实现 settings.ts 白名单**

`backend/src/lib/settings.ts` 第 41 行 `about_content: '',` 之后插入：

```ts
  // 关于页结构化名片块：JSON 数组 [{type:'text'|'kv'|'quote'|'progress'|'marquee', ...}]，
  // 空数组 = 前台回退 about_content 纯文本分段（兼容存量内容）
  about_blocks: '[]',
```

- [ ] **Step 6: 实现 misc.ts 公开解析**

`backend/src/routes/public/misc.ts`：

6a. `/settings/public` 的 getSettings 解构（第 77-93 行）加入 `about_blocks: aboutBlocksRaw`：
keys 数组（第 87-93 行）在 `'about_content',` 后加 `'about_blocks',`；解构处（第 85 行 `author, avatar, about_content: aboutContent,` 后）加 `about_blocks: aboutBlocksRaw,`。

6b. 在 `parseMenu` 定义（第 96-108 行）之后加：

```ts
    // 解析关于页结构化块 JSON；只按 type 白名单过滤，字段校验由前台渲染时兜底
    const parseAboutBlocks = (raw: string): unknown[] => {
      const TYPES = new Set(['text', 'kv', 'quote', 'progress', 'marquee']);
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((b) => b && typeof b === 'object' && typeof (b as any).type === 'string' && TYPES.has((b as any).type));
        }
      } catch {
        /* ignore */
      }
      return [];
    };
    const aboutBlocks = parseAboutBlocks(aboutBlocksRaw);
```

6c. 响应 data 里（第 115 行 `navMenuNormal, navMenuReader, aboutContent,` 后）加 `aboutBlocks,`。

- [ ] **Step 7: 跑测试确认通过**

Run: `cd backend && npm test 2>&1 | tail -5`
Expected: 87/87 passed。

- [ ] **Step 8: Commit**

```bash
cd /e/zcodework/MBLOG && git add backend/src/lib/settings.ts backend/src/routes/public/misc.ts backend/test/posts.test.ts backend/test/admin.test.ts
git commit -m "feat(about): settings 新增 about_blocks 结构化名片块（白名单+公开解析+测试）"
```

---

### Task 2: admin — api 适配层 aboutBlocks

**Files:**
- Modify: `admin/src/api/admin.ts:121`（SiteSettings）、`admin/src/api/admin.ts:602`（getSettings 映射）、`admin/src/api/admin.ts:633`（updateSettings payload）

- [ ] **Step 1: SiteSettings 加字段**

`admin/src/api/admin.ts` 第 121 行 `aboutContent: string;` 后加：

```ts
  aboutBlocks: string;
```

- [ ] **Step 2: getSettings 映射**

第 602 行 `aboutContent: s.about_content || '',` 后加：

```ts
      aboutBlocks: s.about_blocks || '[]',
```

- [ ] **Step 3: updateSettings payload**

第 633 行 `about_content: settings.aboutContent ?? current.about_content,` 后加：

```ts
      about_blocks: settings.aboutBlocks ?? current.about_blocks,
```

- [ ] **Step 4: typecheck**

Run: `cd admin && npm run typecheck 2>&1 | tail -5`
Expected: SettingsPage.vue 报 `aboutBlocks` 缺失初始化（`settings` ref 字面量没加）——先不修，Task 3 一起改；若只有这一处错误则继续。

- [ ] **Step 5: Commit（与 Task 3 合并提交亦可；单独提交时先把 Task 3 Step 1 的初始化带上）**

（为保持每 Task 可编译，把 `SettingsPage.vue` 第 26 行 `aboutContent: '',` 后加 `aboutBlocks: '[]',` 一并提交）

```bash
cd /e/zcodework/MBLOG && git add admin/src/api/admin.ts admin/src/views/SettingsPage.vue
git commit -m "feat(admin): 设置适配层透传 about_blocks"
```

---

### Task 3: admin — SettingsPage 关于块编辑器

**Files:**
- Modify: `admin/src/views/SettingsPage.vue`（script + template 关于区）

- [ ] **Step 1: script 增加块编辑状态与操作**

`SettingsPage.vue` `<script setup>` 中，第 43 行（网易云 refs 之前）插入：

```ts
// 关于页结构化名片块编辑（存储为 JSON 字符串，与 navMenu 同路数）
type BlockType = 'text' | 'kv' | 'quote' | 'progress' | 'marquee';
interface AboutBlock {
  type: BlockType;
  text?: string;
  label?: string;
  value?: string;
  link?: string;
  author?: string;
  title?: string;
  start?: string;
  end?: string;
}
const blockTypeLabels: Record<BlockType, string> = {
  text: '文本', kv: '键值', quote: '引用', progress: '进度', marquee: '跑马灯',
};
const aboutBlocks = ref<AboutBlock[]>([]);
const newBlockType = ref<BlockType>('text');

function parseBlocks(raw: string): AboutBlock[] {
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? (p as AboutBlock[]) : [];
  } catch {
    return [];
  }
}
function addBlock(type: BlockType) {
  const presets: Record<BlockType, AboutBlock> = {
    text: { type, text: '' },
    kv: { type, label: '', value: '', link: '' },
    quote: { type, text: '', author: '' },
    progress: { type, title: '', start: '', end: '' },
    marquee: { type, text: 'KEEP GOING' },
  };
  aboutBlocks.value.push(presets[type]);
}
function removeBlock(i: number) {
  aboutBlocks.value.splice(i, 1);
}
function moveBlock(i: number, dir: -1 | 1) {
  const j = i + dir;
  if (j < 0 || j >= aboutBlocks.value.length) return;
  const [b] = aboutBlocks.value.splice(i, 1);
  aboutBlocks.value.splice(j, 0, b);
}
// 进度百分比：与前台同公式（日期区间自动算，非法区间 0%）
function progressPercent(b: AboutBlock): number {
  const s = Date.parse(b.start || '');
  const e = Date.parse(b.end || '');
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return 0;
  return Math.max(0, Math.min(100, Math.round(((Date.now() - s) / (e - s)) * 100)));
}
function blockSummary(b: AboutBlock): string {
  switch (b.type) {
    case 'kv': return `${b.label || '标签'}：${b.value || '值'}`;
    case 'quote': return b.text || '引用';
    case 'progress': return `${b.title || '约定'} · ${progressPercent(b)}%`;
    default: return b.text || '（空）';
  }
}
```

- [ ] **Step 2: loadSettings 解析 + 保存前序列化**

`loadSettings`（第 51-53 行）改为：

```ts
async function loadSettings() {
  settings.value = await api.getSettings();
  aboutBlocks.value = parseBlocks(settings.value.aboutBlocks);
}
```

`handleSaveSettings`（第 55-66 行）try 块首行加：

```ts
    settings.value.aboutBlocks = JSON.stringify(aboutBlocks.value);
```

- [ ] **Step 3: template 替换关于 textarea 为块编辑器**

删除第 208-211 行（`<div class="mt-3">` 关于我内容 textarea 整块），原位替换为：

```html
          <div class="mt-3">
            <label class="form-label small fw-medium">关于页内容（名片块，前台「关于」页展示）</label>
            <div v-if="aboutBlocks.length === 0" class="text-muted micro-text mb-2">
              暂无区块——前台将回退展示旧版纯文本「关于我内容」。
            </div>
            <div v-for="(b, i) in aboutBlocks" :key="i" class="border rounded-3 p-2 mb-2">
              <div class="d-flex align-items-center gap-2 mb-2">
                <span class="badge badge-soft-primary">{{ blockTypeLabels[b.type] }}</span>
                <span class="text-muted micro-text text-truncate flex-grow-1">{{ blockSummary(b) }}</span>
                <div class="btn-group btn-group-sm">
                  <button type="button" class="btn btn-outline-secondary" :disabled="i === 0" @click="moveBlock(i, -1)">↑</button>
                  <button type="button" class="btn btn-outline-secondary" :disabled="i === aboutBlocks.length - 1" @click="moveBlock(i, 1)">↓</button>
                  <button type="button" class="btn btn-outline-danger" @click="removeBlock(i)">删</button>
                </div>
              </div>
              <template v-if="b.type === 'text'">
                <textarea v-model="b.text" class="form-control form-control-sm" rows="3" placeholder="自我介绍段落…"></textarea>
              </template>
              <template v-else-if="b.type === 'kv'">
                <div class="d-flex gap-2">
                  <input v-model="b.label" class="form-control form-control-sm" placeholder="标签（如：性格）" style="flex: 0 0 100px" />
                  <input v-model="b.value" class="form-control form-control-sm" placeholder="值（如：ENFP 竞选者）" />
                </div>
                <input v-model="b.link" class="form-control form-control-sm mt-1 font-monospace" placeholder="链接（可选，如 https://…）" />
              </template>
              <template v-else-if="b.type === 'quote'">
                <textarea v-model="b.text" class="form-control form-control-sm" rows="2" placeholder="引用文字（如：人生是旷野，不是轨道。）"></textarea>
                <input v-model="b.author" class="form-control form-control-sm mt-1" placeholder="作者（可选，如：梭罗）" />
              </template>
              <template v-else-if="b.type === 'progress'">
                <input v-model="b.title" class="form-control form-control-sm mb-1" placeholder="标题（如：六年之约）" />
                <div class="d-flex gap-2 align-items-center">
                  <input type="date" v-model="b.start" class="form-control form-control-sm" />
                  <span class="text-muted small">→</span>
                  <input type="date" v-model="b.end" class="form-control form-control-sm" />
                  <span class="font-monospace small text-primary flex-shrink-0">{{ progressPercent(b) }}%</span>
                </div>
              </template>
              <template v-else-if="b.type === 'marquee'">
                <input v-model="b.text" class="form-control form-control-sm font-monospace" placeholder="滚动文字（如：KEEP GOING）" />
              </template>
            </div>
            <div class="d-flex gap-2 align-items-center">
              <select v-model="newBlockType" class="form-select form-select-sm" style="width: auto">
                <option v-for="(label, t) in blockTypeLabels" :key="t" :value="t">{{ label }}</option>
              </select>
              <button type="button" class="btn btn-outline-primary btn-sm" @click="addBlock(newBlockType)">添加区块</button>
            </div>
            <div class="text-muted micro-text mt-1">修改后记得顶部「保存所有设置」。为空时前台回退旧版纯文本。</div>
          </div>
```

注意：旧 `settings.aboutContent` 字段不再在表单展示，但适配层仍原样透传（存量内容不丢）。

- [ ] **Step 4: typecheck**

Run: `cd admin && npm run typecheck 2>&1 | tail -5`
Expected: 0 errors。

- [ ] **Step 5: Commit**

```bash
cd /e/zcodework/MBLOG && git add admin/src/views/SettingsPage.vue
git commit -m "feat(admin): 关于页内容改为结构化名片块编辑器（文本/键值/引用/进度/跑马灯）"
```

---

### Task 4: site — AboutBlock 类型 + PublicSettings.aboutBlocks

**Files:**
- Modify: `site/src/lib/api.ts:24`（PublicSettings）、`site/src/lib/api.ts:95-105`（getPublicSettings 兜底）

- [ ] **Step 1: 类型定义**

`site/src/lib/api.ts` `PublicSettings` 接口（第 24 行）之前加：

```ts
// 关于页结构化名片块（settings.about_blocks JSON 解析结果）
export type AboutBlock =
  | { type: 'text'; text: string }
  | { type: 'kv'; label: string; value: string; link?: string }
  | { type: 'quote'; text: string; author?: string }
  | { type: 'progress'; title: string; start: string; end: string }
  | { type: 'marquee'; text: string };
```

`PublicSettings` 内第 36 行 `aboutContent: string;` 后加：

```ts
  aboutBlocks: AboutBlock[];
```

- [ ] **Step 2: getPublicSettings 兜底**

第 96-105 行 catch 兜底对象里（`aboutContent: '',` 后）加：

```ts
    aboutBlocks: [],
```

- [ ] **Step 3: check（此时 about.astro 尚未用到，应无新错误）**

Run: `cd site && npm run check 2>&1 | grep -c "error" || true`
Expected: 与基线一致（about.astro 里 `settings.aboutBlocks` 未使用，不改不报错；若 PublicSettings 兜底处报缺字段，本步已补齐）。

- [ ] **Step 4: Commit**

```bash
cd /e/zcodework/MBLOG && git add site/src/lib/api.ts
git commit -m "feat(site): PublicSettings 增加 aboutBlocks 结构化块类型"
```

---

### Task 5: site — StatBubbles 增加 plain 变体

**Files:**
- Modify: `site/src/components/StatBubbles.vue`

- [ ] **Step 1: 加 variant prop**

`defineProps`（第 6-11 行）改为：

```ts
const props = defineProps<{
  postTotal: number;
  commentTotal: number;
  totalViews: number;
  friendLinkCount: number;
  /** plain = about 页行式统计（复用 .about-stats 样式），默认 bubbles = 首页气泡 */
  variant?: 'bubbles' | 'plain';
}>();
```

- [ ] **Step 2: template 双分支**

`<template>`（第 56-63 行）整体替换为：

```vue
<template>
  <!-- plain：about 页行式统计（类名与 about.astro 原 SSR 标记一致，直接复用既有样式） -->
  <div v-if="variant === 'plain'" class="about-stats">
    <div v-for="b in items" :key="b.key" class="about-stat">
      <span>{{ fmt(displayed[b.key]) }}</span>
      <em>{{ b.label }}</em>
    </div>
  </div>
  <div v-else class="nh-stats-bubbles">
    <div v-for="b in items" :key="b.key" :class="['nh-bubble', b.cls]">
      <span class="num">{{ fmt(displayed[b.key]) }}</span>
      <span class="label">{{ b.label }}</span>
    </div>
  </div>
</template>
```

- [ ] **Step 3: check**

Run: `cd site && npm run check 2>&1 | grep -iE "error" | grep -v "og Buffer\|updatedAt\|Element" || echo OK`
Expected: 无 StatBubbles 相关错误。

- [ ] **Step 4: Commit**

```bash
cd /e/zcodework/MBLOG && git add site/src/components/StatBubbles.vue
git commit -m "feat(site): StatBubbles 增加 plain 变体（about 页行式统计，复用 count-up）"
```

---

### Task 6: site — about.astro 结构化渲染 + 回退 + 动效

**Files:**
- Modify: `site/src/pages/about.astro`（整文件重写）

- [ ] **Step 1: 重写 about.astro**

整文件替换为：

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import StatBubbles from '../components/StatBubbles.vue';
import { getPublicSettings, getStats, type AboutBlock } from '../lib/api';

const settings = Astro.locals.settings ?? (await getPublicSettings());
const siteName = settings.author || settings.siteName || '我的博客';
const avatarUrl = settings.avatar || '/avatar.jpg';
const themeNormal = settings.themeNormal ?? {};
const introText = themeNormal.intro || '一个喜欢折腾代码和生活的博主';
const stats = await getStats().catch(() => ({ postTotal: 0, commentTotal: 0, totalViews: 0, friendLinkCount: 0 }));
const year = new Date().getFullYear();
// 头像相对路径 → 公共绝对 URL（生产走 nginx 同域 /uploads，本地直跑设 PUBLIC_API_BASE）
const PUBLIC_API_BASE = process.env.PUBLIC_API_BASE ?? '';
const absUrl = (u: string) => (u.startsWith('/') && PUBLIC_API_BASE ? `${PUBLIC_API_BASE}${u}` : u);

// 结构化块字段校验：后端只过滤 type，缺必要字段的块这里跳过
function isValidBlock(b: AboutBlock | undefined): boolean {
  if (!b) return false;
  switch (b.type) {
    case 'text':
    case 'quote':
    case 'marquee':
      return typeof b.text === 'string' && b.text.trim() !== '';
    case 'kv':
      return typeof b.label === 'string' && b.label.trim() !== '' && typeof b.value === 'string';
    case 'progress':
      return typeof b.title === 'string' && b.title.trim() !== '' && !!b.start && !!b.end;
    default:
      return false;
  }
}
const aboutBlocks = (settings.aboutBlocks ?? []).filter(isValidBlock);

// 旧内容回退：结构化块为空时按空行分段（段首 emoji 作标签），兼容存量站点
const legacyBlocks = aboutBlocks.length === 0
  ? (settings.aboutContent || '').split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)
  : [];

// 进度百分比：日期区间自动算（与后台预览同公式），非法区间 0%
function progressPercent(b: Extract<AboutBlock, { type: 'progress' }>): number {
  const s = Date.parse(b.start);
  const e = Date.parse(b.end);
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return 0;
  return Math.max(0, Math.min(100, Math.round(((Date.now() - s) / (e - s)) * 100)));
}
const revealDelay = (i: number) => `--reveal-delay:${(i % 5) * 60}ms`;
---
<BaseLayout title="关于" description="关于这个博客与博主。">
  <!-- 全页动态视频背景（webm 循环静音；fixed 铺满，内容滚动其上） -->
  <div class="about-cinema">
    <video class="about-video" autoplay muted loop playsinline preload="metadata" aria-hidden="true" tabindex="-1">
      <source src="/videos/about-bg.webm" type="video/webm" />
    </video>
    <div class="about-video-shade" aria-hidden="true" />

    <div class="about-cinema-body">
      <!-- 首屏：署名 hero（占满视口，浮在视频上） -->
      <div class="about-hero">
        <img class="about-avatar" src={absUrl(avatarUrl)} alt={siteName} />
        <p class="about-kicker">HELLO, I AM</p>
        <h1 class="about-name">{siteName}</h1>
        <p class="about-intro">{introText}</p>
        {settings.siteDesc && <p class="about-desc">{settings.siteDesc}</p>}
        <div class="about-scroll-cue" aria-hidden="true">
          <span>SCROLL</span>
          <i class="about-scroll-line" />
        </div>
      </div>

      <!-- 结构化名片流：text / kv / quote / progress / marquee -->
      {aboutBlocks.length > 0 && (
        <div class="about-blocks">
          {aboutBlocks.map((b, i) => (
            <Fragment>
              {b.type === 'text' && (
                <p class="about-text" data-reveal style={revealDelay(i)}>{b.text}</p>
              )}
              {b.type === 'kv' && (
                <div class="about-kv" data-reveal style={revealDelay(i)}>
                  <span class="about-kv-label">{b.label}</span>
                  <span class="about-kv-leader" aria-hidden="true" />
                  {b.link ? (
                    <a class="about-kv-value is-link" href={b.link} target="_blank" rel="noopener noreferrer">{b.value} ↗</a>
                  ) : (
                    <span class="about-kv-value">{b.value}</span>
                  )}
                </div>
              )}
              {b.type === 'quote' && (
                <blockquote class="about-quote" data-reveal style={revealDelay(i)}>
                  <p class="about-quote-text">{b.text}</p>
                  {b.author && <cite class="about-quote-author">— {b.author}</cite>}
                </blockquote>
              )}
              {b.type === 'progress' && (
                <div class="about-progress" data-reveal style={revealDelay(i)}>
                  <div class="about-progress-head">
                    <span class="about-progress-title">{b.title}</span>
                    <span class="about-progress-num">{progressPercent(b)}%</span>
                  </div>
                  <div class="about-progress-track">
                    <div class="about-progress-fill" style={`width:${progressPercent(b)}%`} />
                  </div>
                  <div class="about-progress-dates">
                    <span>{b.start}</span>
                    <span>{b.end}</span>
                  </div>
                </div>
              )}
              {b.type === 'marquee' && (
                <div class="about-marquee" data-reveal aria-label={b.text}>
                  <div class="about-marquee-track" aria-hidden="true">
                    {Array.from({ length: 8 }).map(() => (
                      <span class="about-marquee-item">{b.text}&nbsp;·&nbsp;</span>
                    ))}
                  </div>
                </div>
              )}
            </Fragment>
          ))}
        </div>
      )}

      <!-- 旧版回退：空行分段 + 段首 emoji 标签（aboutBlocks 为空时） -->
      {legacyBlocks.length > 0 && (
        <div class="about-blocks">
          {legacyBlocks.map((block) => {
            const chars = [...block];
            const first = chars[0];
            const hasEmoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{2700}-\u{27BF}]/u.test(first || '');
            const text = hasEmoji ? block.slice(chars[0].length).trim() : block;
            return (
              <div class="about-block" data-reveal>
                {hasEmoji && <span class="about-block-emoji" aria-hidden="true">{first}</span>}
                <p class="about-block-text">{text}</p>
              </div>
            );
          })}
        </div>
      )}

      <div class="about-stats-wrap" data-reveal>
        <StatBubbles
          client:visible
          variant="plain"
          postTotal={stats.postTotal}
          commentTotal={stats.commentTotal}
          totalViews={stats.totalViews}
          friendLinkCount={stats.friendLinkCount}
        />
      </div>

      <div class="about-links" data-reveal>
        {settings.githubUsername && (
          <a href={`https://github.com/${settings.githubUsername}`} target="_blank" rel="noopener noreferrer">GitHub ↗</a>
        )}
        {settings.doubanUid && (
          <a href={`https://www.douban.com/people/${settings.doubanUid}/`} target="_blank" rel="noopener noreferrer">豆瓣 ↗</a>
        )}
        <a href="/api/rss" target="_blank" rel="noopener noreferrer">RSS ↗</a>
      </div>

      <p class="about-copyright">© {year} {siteName} · Powered by MBLOG</p>
    </div>
  </div>
</BaseLayout>

<script>
  // 背景视频：autoplay 兜底 + 「减少动态」时暂停（对齐智能降级约定）
  const v = document.querySelector<HTMLVideoElement>('.about-video');
  if (v) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      v.pause();
    } else {
      v.play().catch(() => { /* 浏览器限制自动播放时静默后重试 */ });
    }
  }
</script>
```

要点：`.about-hero` 内新增 `.about-scroll-cue`；统计改 StatBubbles plain（SSR 直出真实值，水合 count-up）；astro-island 包裹层用 `.about-stats-wrap`（block 容器，不破坏 flex）。

- [ ] **Step 2: check**

Run: `cd site && npm run check 2>&1 | grep -iE "error" | grep -v "og Buffer\|updatedAt\|Element" || echo OK`
Expected: OK（无新增错误）。

- [ ] **Step 3: Commit**

```bash
cd /e/zcodework/MBLOG && git add site/src/pages/about.astro
git commit -m "feat(site): about 页结构化名片块渲染（kv/引用/进度/跑马灯）+ reveal 级联 + 统计 count-up"
```

---

### Task 7: site — normal.css 结构化块 + 滚动提示样式

**Files:**
- Modify: `site/src/styles/themes/normal.css`（文件末尾追加；`.about-copyright` 规则在第 3038-3045 行，reduced-motion 块在 3046-3054 行——新样式插在 reduced-motion 块之前，并把两条新规则并入该块）

- [ ] **Step 1: 追加结构化块样式**

在 `/* 降级：减少动态时停视频改暗色底 */`（第 3046 行）之前插入：

```css
/* hero 滚动提示（底部居中，呼吸竖线） */
[data-theme='normal'] .about-scroll-cue {
  position: absolute;
  bottom: 26px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.3em;
  color: rgba(255, 255, 255, 0.72);
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
}
[data-theme='normal'] .about-scroll-line {
  width: 1px;
  height: 44px;
  background: linear-gradient(to bottom, var(--color-primary), transparent);
  transform-origin: top;
  animation: about-cue-breathe 2.2s ease-in-out infinite;
}
@keyframes about-cue-breathe {
  0%, 100% { transform: scaleY(0.55); opacity: 0.45; }
  50% { transform: scaleY(1); opacity: 1; }
}
/* hero 需要为绝对定位的滚动提示提供定位上下文 */
[data-theme='normal'] .about-hero { position: relative; }

/* 结构化名片块（normal：视频上白字 + 细线分隔 + 琥珀点缀） */
[data-theme='normal'] .about-text {
  margin: 0 0 18px;
  font-size: 15.5px;
  line-height: 1.9;
  color: rgba(255, 255, 255, 0.94);
  white-space: pre-wrap;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.7);
}
/* 键值行：mono 标签 + 点线引导 + 值（呼应首页分类/归档 leader dots） */
[data-theme='normal'] .about-kv {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 13px 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.14);
}
[data-theme='normal'] .about-kv-label {
  font-family: var(--font-mono);
  font-size: 13px;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.66);
  flex-shrink: 0;
}
[data-theme='normal'] .about-kv-leader {
  flex: 1;
  min-width: 32px;
  border-bottom: 1px dotted rgba(255, 255, 255, 0.32);
  transform: translateY(-4px);
}
[data-theme='normal'] .about-kv-value {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.94);
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.7);
}
[data-theme='normal'] a.about-kv-value {
  color: var(--color-primary);
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--color-primary) 45%, transparent);
  text-underline-offset: 4px;
  transition: color 0.2s ease;
}
[data-theme='normal'] a.about-kv-value:hover { color: #fff; }
/* 引用块：大号斜体衬线 + 琥珀引号 */
[data-theme='normal'] .about-quote {
  margin: 8px 0;
  padding: 34px 8px 28px;
  text-align: center;
  border-top: 1px solid rgba(255, 255, 255, 0.14);
}
[data-theme='normal'] .about-quote-text {
  font-family: var(--font-display);
  font-style: italic;
  font-size: clamp(1.35rem, 3vw, 1.8rem);
  line-height: 1.55;
  color: #fff;
  margin: 0 0 12px;
  text-shadow: 0 3px 24px rgba(0, 0, 0, 0.8);
}
[data-theme='normal'] .about-quote-text::before { content: '\201C'; color: var(--color-primary); margin-right: 0.06em; }
[data-theme='normal'] .about-quote-text::after { content: '\201D'; color: var(--color-primary); margin-left: 0.06em; }
[data-theme='normal'] .about-quote-author {
  display: block;
  font-family: var(--font-mono);
  font-style: normal;
  font-size: 12px;
  letter-spacing: 0.12em;
  color: rgba(255, 255, 255, 0.6);
}
/* 进度块：mono 大百分比 + 琥珀细进度条（辉光）+ 起止日期 */
[data-theme='normal'] .about-progress {
  padding: 26px 4px 22px;
  border-top: 1px solid rgba(255, 255, 255, 0.14);
}
[data-theme='normal'] .about-progress-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 12px;
}
[data-theme='normal'] .about-progress-title { font-size: 15px; color: rgba(255, 255, 255, 0.92); }
[data-theme='normal'] .about-progress-num {
  font-family: var(--font-mono);
  font-size: clamp(22px, 3vw, 28px);
  font-weight: 700;
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
  text-shadow: 0 2px 18px rgba(0, 0, 0, 0.85);
}
[data-theme='normal'] .about-progress-track {
  height: 3px;
  background: rgba(255, 255, 255, 0.16);
  border-radius: 2px;
  overflow: hidden;
}
[data-theme='normal'] .about-progress-fill {
  height: 100%;
  background: var(--color-primary);
  box-shadow: 0 0 14px color-mix(in srgb, var(--color-primary) 80%, transparent);
  border-radius: 2px;
}
[data-theme='normal'] .about-progress-dates {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-family: var(--font-mono);
  font-size: 11.5px;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.55);
}
/* 跑马灯横幅：mono 大写无限滚动，两端渐隐 */
[data-theme='normal'] .about-marquee {
  overflow: hidden;
  margin: 30px 0 6px;
  padding: 16px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.14);
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);
  -webkit-mask-image: linear-gradient(to right, transparent, #000 12%, #000 88%, transparent);
  mask-image: linear-gradient(to right, transparent, #000 12%, #000 88%, transparent);
}
[data-theme='normal'] .about-marquee-track {
  display: inline-flex;
  white-space: nowrap;
  animation: about-marquee-scroll 22s linear infinite;
  will-change: transform;
}
[data-theme='normal'] .about-marquee-item {
  font-family: var(--font-mono);
  font-size: clamp(1.1rem, 2.6vw, 1.5rem);
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 2px 16px rgba(0, 0, 0, 0.75);
  padding-right: 0.6em;
}
@keyframes about-marquee-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
```

- [ ] **Step 2: 扩充文件末尾既有 reduced-motion 块**

第 3047-3053 行的 `@media (prefers-reduced-motion: reduce)` 块内（`.about-video-shade` 规则后）追加：

```css
  [data-theme='normal'] .about-marquee-track { animation: none; }
  [data-theme='normal'] .about-scroll-line { animation: none; }
```

- [ ] **Step 3: check + Commit**

Run: `cd site && npm run check 2>&1 | grep -iE "error" | grep -v "og Buffer\|updatedAt\|Element" || echo OK`
Expected: OK。

```bash
cd /e/zcodework/MBLOG && git add site/src/styles/themes/normal.css
git commit -m "feat(site): about 结构化块 normal 样式（leader dots 键值/引用/辉光进度/跑马灯/滚动提示）"
```

---

### Task 8: site — reader.css 视频隐藏修复 + 极简块样式

**Files:**
- Modify: `site/src/styles/themes/reader.css`（文件末尾追加）

- [ ] **Step 1: 修复 + 追加样式**

文件末尾追加：

```css
/* ---------- 关于页：reader 修复 + 结构化块极简适配 ---------- */
/* 视频背景为 normal 专属（跨主题隐藏用外部规则，GradientBlob 先例） */
[data-theme='reader'] .about-video,
[data-theme='reader'] .about-video-shade {
  display: none;
}
[data-theme='reader'] .about-scroll-cue { display: none; }
[data-theme='reader'] .about-kicker {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--color-primary);
  margin: 0 0 6px;
}
/* 结构化块（reader 极简：细线/左边框/细进度条） */
[data-theme='reader'] .about-text {
  margin: 0 0 16px;
  font-size: 0.9375rem;
  line-height: 1.9;
  color: var(--color-text-secondary);
  white-space: pre-wrap;
}
[data-theme='reader'] .about-kv {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 12px 0;
  border-top: 1px solid var(--color-border);
}
[data-theme='reader'] .about-kv-label {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  flex-shrink: 0;
}
[data-theme='reader'] .about-kv-leader {
  flex: 1;
  min-width: 24px;
  border-bottom: 1px dotted var(--color-border);
  transform: translateY(-3px);
}
[data-theme='reader'] .about-kv-value { font-size: 0.9375rem; color: var(--color-text); }
[data-theme='reader'] a.about-kv-value { color: var(--color-primary); }
[data-theme='reader'] .about-quote {
  margin: 8px 0;
  padding: 24px 0 20px;
  border-top: 1px solid var(--color-border);
  text-align: center;
}
[data-theme='reader'] .about-quote-text {
  font-family: var(--font-display);
  font-style: italic;
  font-size: 1.15rem;
  color: var(--color-text-heading);
  margin: 0 0 8px;
}
[data-theme='reader'] .about-quote-text::before { content: '\201C'; color: var(--color-primary); }
[data-theme='reader'] .about-quote-text::after { content: '\201D'; color: var(--color-primary); }
[data-theme='reader'] .about-quote-author {
  display: block;
  font-style: normal;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
[data-theme='reader'] .about-progress { padding: 20px 0 16px; border-top: 1px solid var(--color-border); }
[data-theme='reader'] .about-progress-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 10px;
}
[data-theme='reader'] .about-progress-title { font-size: 0.9375rem; color: var(--color-text); }
[data-theme='reader'] .about-progress-num {
  font-family: var(--font-mono);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
}
[data-theme='reader'] .about-progress-track {
  height: 3px;
  background: var(--color-border);
  border-radius: 2px;
  overflow: hidden;
}
[data-theme='reader'] .about-progress-fill { height: 100%; background: var(--color-primary); }
[data-theme='reader'] .about-progress-dates {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--color-text-muted);
}
[data-theme='reader'] .about-marquee {
  overflow: hidden;
  margin: 24px 0 4px;
  padding: 12px 0;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}
[data-theme='reader'] .about-marquee-track {
  display: inline-flex;
  white-space: nowrap;
  animation: reader-marquee 26s linear infinite;
}
[data-theme='reader'] .about-marquee-item {
  font-family: var(--font-mono);
  font-size: 1rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  padding-right: 0.6em;
}
@keyframes reader-marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
@media (prefers-reduced-motion: reduce) {
  [data-theme='reader'] .about-marquee-track { animation: none; }
}
```

- [ ] **Step 2: check + Commit**

Run: `cd site && npm run check 2>&1 | grep -iE "error" | grep -v "og Buffer\|updatedAt\|Element" || echo OK`
Expected: OK。

```bash
cd /e/zcodework/MBLOG && git add site/src/styles/themes/reader.css
git commit -m "fix(site): about 页 reader 主题隐藏视频背景 + 结构化块极简适配"
```

---

### Task 9: 全量验证 + 双主题渲染 smoke

**Files:** 无新改动（只验证）

- [ ] **Step 1: 三端静态检查**

```bash
cd /e/zcodework/MBLOG/backend && npm test 2>&1 | tail -3          # 期望 87/87
cd ../site && npm run check 2>&1 | grep -ciE " error" || true      # 期望与基线一致（无新增）
cd ../admin && npm run typecheck 2>&1 | tail -3                    # 期望 0 errors
```

- [ ] **Step 2: 造演示数据**

```bash
cd /e/zcodework/MBLOG/backend && node -e "
const db = require('better-sqlite3')('data/mblog.db');
const blocks = [
  { type: 'text', text: '一个喜欢折腾代码和生活的博主。白天写码，晚上写字。' },
  { type: 'kv', label: '生于', value: '2002' },
  { type: 'kv', label: '专业', value: '软件工程' },
  { type: 'kv', label: '性格', value: 'ENFP 竞选者', link: 'https://www.16personalities.com/ch/enfp-人格' },
  { type: 'quote', text: '人生是旷野，不是轨道。', author: '梭罗' },
  { type: 'progress', title: '六年之约', start: '2024-12-31', end: '2030-12-31' },
  { type: 'marquee', text: 'KEEP GOING' },
];
db.prepare(\"INSERT INTO settings(key, value) VALUES('about_blocks', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value\").run(JSON.stringify(blocks));
console.log('seeded');
"
```

- [ ] **Step 3: 起服务并 smoke**

```bash
cd /e/zcodework/MBLOG/backend && npm run dev &            # :3000
cd /e/zcodework/MBLOG/site && API_BASE=http://localhost:3000 npm run dev &   # :4321
sleep 8
curl -s http://localhost:4321/about | grep -o "about-kv\|about-quote\|about-progress\|about-marquee\|about-scroll-cue\|about-stats" | sort | uniq -c
```

Expected: 每类选择器都有命中（about-kv ≥3、about-quote 1、about-progress 1、about-marquee 1、about-scroll-cue 1、about-stats 1）。

- [ ] **Step 4: 浏览器双主题目检（ZCode 后台托管已跑服务时）**

- normal：视频上 kv leader dots / 引用琥珀引号 / 进度辉光条 / 跑马灯滚动 / SCROLL 呼吸 / 滚动 reveal / 统计 count-up
- 切 reader（前台 ThemeToggle）：视频消失、极简浅色块正常
- 验证后清演示数据（可选，或留给用户在后台编辑真实内容）：
  `cd backend && node -e "require('better-sqlite3')('data/mblog.db').prepare(\"UPDATE settings SET value='[]' WHERE key='about_blocks'\").run(); console.log('cleared')"`

---

### Task 10: 更新项目记忆 + 收尾

**Files:**
- Modify: `docs/PROJECT-MEMORY.md`

- [ ] **Step 1: 记忆追加本会话成果**

在「5b. 今日已完成的工作」后新增一节（沿用既有格式）：

```markdown
## 5c. 2026-08-16：About 页结构化名片块

- **backend**：settings 新增 `about_blocks`（JSON 数组，DEFAULT_SETTINGS 白名单）；/settings/public 返回解析后 `aboutBlocks`（type 白名单过滤）；测试 85→87
- **admin**：SettingsPage 关于 textarea → 块编辑器（文本/键值/引用/进度/跑马灯，上移下移删除 + progress 实时百分比预览）
- **site**：about.astro 按 aboutBlocks 结构化渲染（kv=leader dots 行式、quote=斜体衬线琥珀引号、progress=mono 百分比+辉光细条按日期自动算、marquee=无限滚动两端渐隐）；空数组回退旧 aboutContent 分段；全块 data-reveal 级联；统计换 StatBubbles `variant="plain"`（SSR 真值+水合 count-up）；hero 加 SCROLL 滚动提示
- **reader 修复**：视频/遮罩/滚动提示在 reader 外部规则隐藏（GradientBlob 先例）+ 结构化块极简样式
- **视频背景按用户决定不做降级**（reduced-motion 暂停保留）
```

- [ ] **Step 2: Commit**

```bash
cd /e/zcodework/MBLOG && git add docs/PROJECT-MEMORY.md
git commit -m "docs(memory): 记录 about 结构化名片块改造"
```

---

## Self-Review 记录

- Spec 覆盖：backend 字段（Task 1）/ admin 编辑器（Task 2-3）/ site 类型（4）/ count-up（5-6）/ 渲染+回退+reveal+滚动提示（6）/ normal 视觉（7）/ reader 修复+样式（8）/ 验证（9）/ 记忆（10）——全覆盖；视频降级按用户决定不做 ✓
- 类型一致：`AboutBlock` site 定义（api.ts）与 about.astro 校验/渲染一致；admin 本地 `AboutBlock` 接口（含全部可选字段）与编辑器一致；`progressPercent` 前后台同公式（刻意小重复，公式单一）
- 无占位符；所有步骤含完整代码与期望输出
