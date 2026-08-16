# About 页 hero 视频渐隐融合设计（迭代）

> 日期：2026-08-16（对 2026-08-16-about-page-design.md 的视觉迭代）
> 动机：整页 fixed 视频让 about 与站内其它页面（暗底+辉光+编辑式）气质割裂，切换突兀。
> 用户决定：视频不必铺整页；hero 渐隐融合方案。

## 改动（仅 site 两文件）

1. **结构（about.astro）**：去掉 `.about-cinema`/`.about-cinema-body` 整页容器；`<video>`+遮罩移入 `.about-hero` 内（absolute 铺满，随滚动离场）；hero 下方内容包进 `.about-body`（relative 容器 + `<GradientBlob />`，与 posts/archive 同款辉光）；script/块渲染/回退/count-up 全不动。
2. **视频主题化（normal.css）**：视频 `position:absolute; inset:0`（限 hero 内）+ 暖调 filter（sepia/hue-rotate 向琥珀、压暗）；遮罩改 `顶部轻暗 → 底部 var(--color-bg) 全不透明`，hero 底边无缝溶入页面底色；hero 文字加 `position:relative; z-index:1` 压到视频/遮罩之上（白字+阴影保留）。
3. **下方内容配色回归主题变量**：kv/引用/进度/跑马灯/统计/外链/版权的白 rgba 与 text-shadow 换 `--color-text*`/`--color-border`，琥珀点缀保留；`.about-body` 沿用 720px 版心。
4. **reader 零改动**：视频/遮罩/SCROLL 早已 display:none；GradientBlob 有 reader 隐藏外部规则；`.about-body` 在 reader 为普通流容器。

## 验证

`npm run check` 0 新错误；浏览器双主题实测（normal：视频限 hero、底边渐隐无分界线、下方内容主题配色+辉光；reader：与改前一致）。
