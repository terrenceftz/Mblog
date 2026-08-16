# About 页优化设计（结构化名片 + editorial 动效 + reader 修复）

> 日期：2026-08-16
> 范围：backend（settings 结构化字段）+ admin（块编辑器）+ site（结构化渲染 / 视觉动效 / reader 修复）
> 参考：https://eonova.me/about/（名片式结构）、项目记忆 docs/PROJECT-MEMORY.md

## 背景与目标

About 页现状（`7a7a783` 视频背景版）：normal 主题为全页 fixed 视频背景 + 100vh hero + 后台纯文本分段名片流；内容编辑仅一个 textarea（空行分段 + 段首 emoji 标签），无法表达键值对 / 引用 / 进度条等 eonova 式结构。reader 主题下视频/遮罩样式全部缺失（样式只写了 `[data-theme='normal']` 前缀），布局是坏的。08-15 编辑式改版的 reveal 级联也在视频改版中丢失。

目标：

1. **内容结构化**：后台可视化编辑 eonova 式名片块，前台双主题结构化渲染
2. **视觉/动效**：恢复并升级 editorial 语言（leader dots 键值行、引用块、进度条、跑马灯、reveal 级联、统计 count-up、hero 滚动提示）
3. **reader 修复**：视频/遮罩在 reader 下隐藏，结构化块极简适配
4. **明确不做**：视频背景不做降级（用户决定；reduced-motion 暂停逻辑已有，保留）

## 1. 数据模型（backend）

沿用 navMenu 模式（settings 表存 JSON 字符串，无新表）：

- `src/lib/settings.ts` 的 `DEFAULT_SETTINGS` 新增 `about_blocks: '[]'`（白名单，避免 PUT 静默丢弃）
- 块类型定义（存储 JSON 数组，每块必有 `type`）：

| type | 字段 | 前台呈现 |
|---|---|---|
| `text` | `text: string` | 段落（沿用现名片流白字样式） |
| `kv` | `label: string`、`value: string`、`link?: string` | `label ······ value` leader dots 键值行，value 可外链 |
| `quote` | `text: string`、`author?: string` | 引用块 |
| `progress` | `title: string`、`start: string`、`end: string`（YYYY-MM-DD） | 进度按当前日期自动算百分比，显示起止日期 |
| `marquee` | `text: string` | 无限横向滚动横幅（reduced-motion 静态） |

- `src/routes/public/misc.ts`：public settings 返回 `aboutBlocks`（解析后的数组，解析失败回退 `[]`）
- 旧 `about_content` / `aboutContent` **保留不删**：`aboutBlocks` 为空数组时前台回退旧的空行分段渲染——平滑迁移，老站内容不打断

## 2. 后台（admin）

SettingsPage「博主信息」卡：关于 textarea → 块编辑器（Tabler + `--mb-*` 体系内）：

- 块列表行：类型徽章（badge-soft）+ 内容摘要 + 上移 / 下移 / 删除
- 「添加区块」类型下拉（文本/键值/引用/进度/跑马灯），按类型切换表单字段：
  - text：textarea
  - kv：label / value / link（url 输入）
  - quote：text / author
  - progress：title / start / end（`<input type="date">`）
  - marquee：text
- 实时预览百分比（progress 按日期自动算，与前台同公式）
- 保存：`updateSettings({ aboutBlocks: JSON.stringify(blocks) })`（同 navMenu 路数）；旧的 aboutContent 字段从表单移除

## 3. 前台（site/src/pages/about.astro）

### 3.1 数据与回退

- `settings.aboutBlocks` 非空 → 渲染结构化块；空 → 现有 aboutContent 空行分段 + emoji 标签逻辑原样保留（fallback）
- progress 百分比公式：`clamp(0, (now - start) / (end - start), 100)`，取整；`end <= start` 或日期非法 → 0%

### 3.2 normal 主题视觉（editorial 语言，全部 `[data-theme='normal']` 前缀）

- `kv`：mono label（灰白）+ leader dots（点线引导，呼应首页分类/归档月份头）+ 白 value；value 有 link 则琥珀下划线可点；连续 kv 行间细线成组
- `quote`：去掉普通块分隔线；大号斜体衬线（--font-display）+ 琥珀大引号 + mono 小字作者
- `progress`：mono 大号百分比数字（琥珀，视频上 text-shadow）+ 细进度条（琥珀填充 + 辉光）+ 起止日期 mono 小字两端对齐
- `marquee`：整宽横幅，mono 大写文字无限横向滚动（CSS animation，duplicate 内容保证无缝），reduced-motion 静态展示一份
- text：沿用现有 `.about-block` 白字段落样式
- 全部块加 `data-reveal`（复用 `scripts/reveal.ts`，一次性 IntersectionObserver，stagger 级联）
- 统计 count-up：复用 StatBubbles（props 与 about 页 stats 一模一样：postTotal/commentTotal/totalViews/friendLinkCount），给它加 `variant?: 'bubbles' | 'plain'` prop 切换根类名——about 用 `plain` 保持现有 mono 琥珀数字外观，仅复用「SSR 直出真实值 + 水合 count-up + reduced-motion 落定」逻辑
- hero 滚动提示：hero 底部 `SCROLL` mono 小字 + 竖线呼吸动画，reduced-motion 关闭动画只留静态提示

### 3.3 reader 主题修复

- `reader.css` **外部规则**隐藏视频与遮罩：`[data-theme='reader'] .about-video, [data-theme='reader'] .about-video-shade { display: none; }`（GradientBlob 先例：跨主题隐藏用外部 CSS，不动组件）
- `.about-cinema` 在 reader 下恢复文档流（外部规则去除全屏假设，reader 本就极简居中）
- 结构化块 reader 样式：kv 细线行（--color-border）、quote 左边框、progress 细进度条、marquee 静态灰字横幅
- reveal 在 reader 同样生效（全站惯例）

## 4. 验证

- backend：`npm test`（新增 settings 白名单含 about_blocks + public settings 返回 aboutBlocks 的断言，85 → 87 预期）
- site：`npm run check` 0 errors
- admin：`npm run typecheck` 通过
- 本地双主题渲染：normal 视频上结构化块/reveal/统计 count-up 正常；reader 无视频、极简结构化块正常；`aboutBlocks` 为空时旧内容回退正常

## 5. 风险与既知坑对照

- settings 新 key 必须进 DEFAULT_SETTINGS（坑 12）
- 跨主题隐藏用外部 CSS 不用 scoped :global（坑 4/事故 1）
- reveal.ts 是一次性 observer，重复添加 data-reveal 无副作用
- marquee 动画必须 respect prefers-reduced-motion（记忆约定）
- admin 插卡片注意 col 结构闭合（坑 11）
