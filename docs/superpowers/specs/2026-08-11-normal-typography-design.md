# 正常主题全站字体方案（Playfair 高对比衬线）

日期：2026-08-11
状态：已批准（用户确认）

## 背景

正常主题（eonova 暗色科技风）目前全站只有系统字体、没有字体层级区分：
`--font-body / --font-display / --font-ui` 全部指向同一个系统无衬线栈。
极简主题使用 Lora / EB Garamond / Noto Serif SC（衬线书卷气），两者没有形成字体区分。

目标：为正常主题规划一套「技术 × 文艺」反差的全站字体层级，
区块标题等展示性文字用高对比衬线，正文保持系统无衬线可读性，
数字/元信息用等宽字体。用户通过浏览器字体对比（6 个方向）选定 **E · Playfair 高对比衬线**。

## 1. 字体栈（normal.css）

| 变量 | 字体栈 | 说明 |
|---|---|---|
| `--font-display` | `'Playfair Display', 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', serif` | 西文 Playfair 高对比衬线；中文回落思源宋体/系统宋体 |
| `--font-body` | 系统无衬线（现状不变） | 中文正文可读性 |
| `--font-mono` | `'JetBrains Mono', 'Fira Code', ui-monospace, monospace` | 眉题、日期、数字、元信息、代码 |
| `--font-ui` | 系统无衬线（现状不变） | 交互控件 |

## 2. 全站字体层级

| 场景 | 字体 | 规格 |
|---|---|---|
| Hero 主标题 | Display 衬线 | 700，clamp(2–2.8rem)，维持现字号 |
| Hero 趣味介绍行（BlurText witty） | Display 衬线 | 18px，400 |
| 区块标题（最新文章/分类与标签/最近观影/精选项目） | Display 衬线 | 24px，700 |
| 眉题（LATEST POSTS / EXPLORE / MOVIES / PROJECTS） | Mono | 12px，0.25em 字距，琥珀色（现状） |
| 文章卡片标题 | Display 衬线 | 17px，600 |
| 项目卡名称 | Display 衬线 | 600 |
| 正文 / 摘要 | Body 无衬线 | 13–16px 灰阶（现状） |
| 日期 / 浏览数 / 元信息 | Mono | 12px，tabular-nums |
| 文章页标题 | Display 衬线 | 32px，700 |
| 文章页 markdown h1–h3 | Display 衬线 | 继承现有字号 |
| 分类/标签胶囊、影音海报 | 不变 | 无衬线胶囊 / 纯海报 |

## 3. 首页区块差异化

- 区块标题统一「等宽眉题 + 衬线大标题」，与正文无衬线拉开层级（区块与区块之间由眉题英文区分）。
- 浏览数、日期等数字用 `JetBrains Mono` + `tabular-nums`，形成「技术数字 × 文艺衬线」反差。
- 影音模块保持纯海报无文字干扰。

## 4. 「最新文章 → 全部文章」入口

在首页「最新文章」区块标题（h2）下方居中新增链接「查看全部文章 →」，
指向 `/archive`，样式与「最近观影 / 精选项目」的「查看全部 →」一致（`.nh-more`）。

## 5. 字体加载（BaseLayout.astro）

Google Fonts 链接新增两个字体族，保留极简主题现有字体：

```
family=Playfair+Display:ital,wght@0,500..800;1,500..700
family=JetBrains+Mono:wght@400;500;600
```

现有 `Lora / EB Garamond / Noto Serif SC` 保留给极简主题，不受影响。

## 边界

- 全部改动限定在正常主题（`[data-theme='normal']` 前缀）与 BaseLayout 字体加载行；极简主题视觉零改动。
- 不做自定义 @font-face 自托管；沿用 Google Fonts。
- 不加粗/加宽现有布局结构与间距，只改字体族与少量字重/字距。
