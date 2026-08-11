# MBLOG 后台 UI 精修打磨 + 浅色主题

**日期**: 2026-08-11
**范围**: `admin/` 子项目（Vue 3 SPA 后台）
**目标力度**: 精修打磨（延续现有"暗色科技 + 琥珀金"风格，系统性提升）
**新增能力**: 后台独立双主题（暗/浅），默认跟随系统，可手动切换并记忆

## 背景与问题

当前后台已是一套克制度高、风格统一的纯手写 CSS 暗色后台，但存在以下系统性短板：

1. **Token 集中度不足** — `:root` 只定义了 11 个变量，组件 scoped 样式里大量硬编码十六进制色值（`#e8b64c`/`#9d9d95`/`#5c5c66`/`#101014`/`#1f1f24`/`#3f3f46` 等），散落十几个文件。
2. **无阴影/层级体系** — 扁平到极致，缺 z 轴层次 token（仅 toast/login 例外），浮层/弹窗难以体面呈现。
3. **无间距/字号 scale** — 间距散落（8/10/12/14/16/18/20/24/32/48px 混用），字号也无体系。
4. **组件细节不统一** — hover/active/过渡时长有 0.15s/0.18s/0.2s/0.25s 四种，按钮与卡片的 hover 反馈不一致。
5. **无浅色主题** — 后台写死暗色，无法跟随系统或手动切换（前台已有 reader 浅色主题）。

## 设计决策

| 决策点 | 选择 | 理由 |
|---|---|---|
| 优化力度 | 精修打磨 | 风格已成熟，延续而非重构 |
| 设计语言 | 延续现有琥珀风 | 低风险高收益 |
| 浅色主题联动 | 后台独立双主题 | 与前台解耦，自成体系 |
| 默认行为 | 跟随系统（auto），可手动切换并记忆 | 符合现代后台习惯 |

## 设计方案

### 1. Token 体系化（核心地基）

重构 `admin/src/styles/admin.css` 的 `:root`，token 分三层：

**语义层**（组件只引用这一层，绝不直接用色值）：
```css
--bg, --surface, --surface-2, --surface-3   /* 背景四档 */
--border, --border-strong                   /* 边框两档 */
--text, --text-muted, --text-subtle         /* 文字三档 */
--primary, --primary-hover, --primary-soft, --primary-contrast
--ok, --warn, --danger, --info              /* 功能色 */
```

**阴影/层次层**（新增）：
```css
--shadow-sm   /* 卡片 hover 极轻阴影 */
--shadow-md   /* 次级浮层 */
--shadow-lg   /* toast/抽屉 */
--shadow-pop  /* 弹窗/下拉 */
```

**节奏层**（新增 scale，暗/浅主题共享）：
```css
--space-1..--space-8  (4/8/12/16/20/24/32/40px)
--radius-sm/md/lg/full (6/8/12/999px)
--font-xs/sm/base/md/lg/2xl (12/13/14/16/18/22px)
--transition-fast (0.15s) / --transition-base (0.2s)
--focus-ring  /* focus 主色光晕 */
```

暗/浅两套主题各自覆盖语义层 + 阴影层；节奏层保持一致。

**铁律**：组件样式里**消灭所有硬编码色值**，全部改用变量引用。新增色值若不在 token 里，先加 token 再用。

### 2. 视觉层次与质感

- **背景层次拉开**：暗色主题把 `--bg`/`--surface`/`--surface-2` 明度差从当前约 2-3% 拉到 4-5%。
- **引入轻阴影系统**（克制使用）：
  - 卡片默认无阴影（保持克制）
  - hover 态卡片加 `--shadow-sm`
  - 浮层（Toast/抽屉/下拉/弹窗）用 `--shadow-lg`/`--shadow-pop`
  - 暗色阴影 `rgba(0,0,0,0.2~0.5)`，浅色用 `rgba(15,23,42,0.06~0.14)`
- **主色软背景 `--primary-soft`**：统一所有"主色微高亮"场景（表格行 hover、激活态背景、标签胶囊底）。
- **focus 光晕统一**：`--focus-ring` token，所有表单控件 focus 时都带极轻光晕。

### 3. 间距与排版节奏

- 间距全部走 `--space-*` scale，组件 padding/gap/margin 只从 8 档选。
- 字号 scale 6 档：xs(12)/sm(13)/base(14)/md(16)/lg(18)/2xl(22)，全部引用变量。
- **页头结构强化**：新增 `.page-header`（title + 右侧操作槽），列表页"新建"按钮等移入页头右侧。
- 表格行高微调：纵向 padding 从 10px 拉到 12px，信息更通透。

### 4. 组件细节统一 + 微交互

- **过渡统一**：全项目只用 `--transition-fast` (0.15s) / `--transition-base` (0.2s)。
- **按钮体系统一**：
  - 默认描边款 hover：边框提亮 + 文字变主色 + 极轻 `translateY(-1px)`
  - primary 实心款 hover：`brightness(1.08)` + 极轻阴影
  - 新增 `.btn.ghost`（无边框透明款，次要操作如"取消"）
  - `:active` 加 `translateY(0)` + `filter: brightness(0.97)` 反馈
- **表格行 hover** 用 `--primary-soft`，过渡 `--transition-base`。
- **徽章** padding 统一 `3px 10px` + `letter-spacing: 0.02em`。
- **入场动画**（克制）：统计卡、列表项首次渲染 fade-in + translateY（0.3s，仅一次）。

### 5. 浅色主题

- **主题管理** `admin/src/lib/theme.ts`：管理 `dark`/`light`/`auto` 三态，存 `localStorage`，在 `<html>` 上切换 `data-theme`。
- **主题切换器**：侧栏底部 `.admin-actions` 区，太阳/月亮图标切换。
- **首屏防闪白**：`main.ts` 在挂载前同步读取并设置主题。
- **浅色配色**（与前台 reader 呼应，独立，保持琥珀主色）：
  ```css
  --bg: #f7f7f4; --surface: #ffffff; --surface-2: #f1f1ec;
  --border: #e4e4df; --border-strong: #d4d4cf;
  --text: #1a1a1f; --text-muted: #6b6b66; --text-subtle: #9a9a94;
  --primary: #d99a2b; --primary-soft: rgba(217,154,43,0.10);
  --primary-contrast: #ffffff;
  ```
- **登录页**：浅色下光斑改低饱和，毛玻璃卡改纯白卡 + 轻阴影。
- **Vditor 编辑器**：浅色下切换到 Vditor light 主题。

## 实施顺序

1. 重构 `admin.css` token 体系（语义层 + 阴影 + 节奏层）+ 暗色主题值
2. 新增 `theme.ts` + 浅色主题变量 + `<html>` 主题属性切换
3. AdminLayout 布局改造 + 主题切换器 UI
4. 逐文件把硬编码色值替换为变量引用
5. 间距/字号 scale 落地到各组件 + 页头结构改造
6. 组件细节统一 + 微交互 + 入场动画
7. 全量验证（跑 admin dev，逐页检查暗/浅两套主题）

## 涉及文件

- `admin/src/styles/admin.css` — token 重构主战场
- `admin/src/lib/theme.ts` — 新增
- `admin/src/main.ts` — 首屏主题同步
- `admin/src/views/AdminLayout.vue` — 布局 + 切换器
- `admin/src/views/{Login,Dashboard,PostList,PostEditor,CategoryManager,TagManager,CommentManager,TalkManager,FriendLinkManager,SettingsPage,ThemesPage}.vue`
- `admin/src/components/{TagPicker,ToastContainer}.vue`

## 不做（YAGNI）

- 不引入 CSS 框架或 UI 组件库（保持纯手写）
- 不做主题色自定义（前台 ThemesPage 已有，后台不重复）
- 不做组件库抽象（列表页 toolbar+table+pagination 结构暂不抽公共组件，本次只统一视觉）
- 不做图标组件化（SVG 内联保持现状，仅本次新增图标沿用）
