# 正常主题暗色改造（eonova 风格）设计文档

日期：2026-08-11
状态：已确认

## 背景

正常主题全面改为暗色科技风（视觉参考 https://eonova.me/），首页重构为内容丰富模块化页面；极简主题完全隔离不受影响。

## 一、暗色配色（eonova 风格）

| 变量 | 值 | 说明 |
|---|---|---|
| `--color-bg` | `#09090b` | 页面背景（zinc-950） |
| `--color-surface` | `#131316` | 卡片/区块背景 |
| `--color-text` | `#f4f4f5` | 正文 |
| `--color-text-muted` | `#9d9d95` | 弱化文字 |
| `--color-primary` | `#e8b64c` | 暖金强调色（链接/按钮/装饰） |
| `--color-border` | `#26262a` | 发丝边框 |
| `--color-border-strong` | `#3f3f46` | 强调边框 |
| `--color-code-bg` | `#18181b` | 代码底色 |
| `--radius` | `12px` | 卡片圆角 |
| `--shadow` | `0 8px 30px rgba(0,0,0,0.35)` | 卡片阴影 |
| `--max-width` | `1100px` | 内容列宽 |

## 二、首页模块（单列堆叠，双渲染隔离）

`index.astro` 双渲染：`.reader-home`（极简时间线，保留）与 `.normal-home`（新首页）。
- normal 主题显示 `.normal-home`、隐藏 `.reader-home`（`[data-theme='normal'] .reader-home { display:none }`）
- reader 主题显示 `.reader-home`、隐藏 `.normal-home`（`[data-theme='reader'] .normal-home { display:none }`）

**模块**：
1. **Hero**：英文小标签（eyebrow）+ 站点名大标题 + 简介 + banner 大图（圆角通栏）
2. **数据统计**：4 张统计卡（文章/评论/浏览/友链）——新增公共接口 `GET /api/stats`
3. **最新文章**：封面卡片网格（无封面用渐变占位块）+ 标题 + 摘要 + meta（日期/阅读量/分类）
4. **分类·标签**：分类胶囊（带文章数）+ 标签云
5. **影音·项目**：最近观影海报横排（8 部）+ 精选项目卡（6 个），各带「查看全部」

## 三、全站暗色适配

各页面（文章/归档/友链/项目/影音/搜索/分类/标签）均基于 CSS 变量渲染，暗色配色自动生效；
`normal.css` 重写组件样式（顶栏、卡片、分页、标签、评论区）与暗色 hover 效果。

## 四、后台

`ThemesPage.vue` 的 `DEFAULTS.normal` 更新为暗色默认值（bg/text/muted/primary/border/fontSize），
保证「恢复默认」回到暗色。

## 五、涉及文件

**后端**：`src/routes/public/stats.ts`（新）、`src/routes/public.ts`、`test/stats.test.ts`（新）

**前台**：`site/src/lib/api.ts`、`site/src/pages/index.astro`、`site/src/styles/themes/normal.css`、`site/src/styles/themes/reader.css`

**后台**：`admin/src/views/ThemesPage.vue`
