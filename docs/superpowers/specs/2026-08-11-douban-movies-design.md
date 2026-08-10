# MBLOG 豆瓣影音展示 设计文档

日期：2026-08-11
状态：已确认

## 背景

前台新增「影音」展示页：后台配置豆瓣用户 ID，前台展示该用户「看过」的电影记录（封面、标题、评分、观影日期）。

## 一、数据源

- 接口：`https://www.douban.com/feed/people/{uid}/interests`（RSS 2.0，已实测可用）
- 请求头：`User-Agent: Mozilla/5.0 ... MBLOG/1.0`
- 条目结构（`<item>`）：
  - `<title>看过辛德勒的名单</title>`（动作前缀 + 标题）
  - `<link>https://movie.douban.com/subject/.../</link>`（类型由域名区分）
  - `<description>` CDATA 内含 `<img src="封面URL">` 与 `推荐: 力荐` 评分文字
  - `<pubDate>Mon, 29 Aug 2005 00:19:48 GMT</pubDate>`

## 二、过滤与映射

- 仅保留：`link` 含 `movie.douban.com`（电影）且 `title` 以「看过」开头
- 标题：去掉「看过」前缀
- 评分：力荐=5，推荐=4，还行=3，较差=2，很差=1（无评分=0，不显示星级）
- 日期：pubDate → `YYYY-MM-DD`

## 三、后端

- 依赖新增 `fast-xml-parser`（XML 解析）
- 设置键：`douban_enabled`（'0'/'1'）、`douban_uid`；`nav_menu` 默认加入「影音」→ `/douban`
- 新接口 `GET /api/douban`（`backend/src/routes/public/douban.ts`，挂载于 public router）：
  - 未开启/无 UID → `{ data: { enabled: false, movies: [] } }`
  - 拉取 → 解析 → 过滤映射 → **内存缓存 30 分钟**（键为 UID，复用 GitHub 模式）
  - 失败：有缓存回退（`stale: true`），否则 `error` 提示

## 四、前台

- `site/src/lib/api.ts`：`PublicSettings` 扩展 `doubanEnabled`/`doubanUid`；新增 `DoubanMovie` 接口与 `getDouban()`
- 新页 `site/src/pages/douban.astro`（「影音」）：
  - 状态：未开启 / 拉取失败 / 无记录 / 电影海报网格
  - 每项：封面（2:3）、标题、星级（★ 按 rating）、观影日期；整卡链接到豆瓣条目
  - 双主题：极简模式克制海报墙（标题悬停变赭红）；正常模式卡片网格
  - 空态/错误态复用 projects 模式

## 五、后台

- `admin/src/views/SettingsPage.vue`：新增「豆瓣影音展示」fieldset（开启 select + 豆瓣 ID input + 提示）

## 六、测试

- 后端 `test/douban.test.ts`：
  - 解析样例 feed（mock fetch）：仅保留电影 + 看过、标题去前缀、评分映射、日期格式化
  - 未开启/无 UID → enabled:false
  - 缓存：TTL 内第二次请求不再 fetch
  - 拉取失败 → error 提示

## 七、涉及文件

**后端**：`package.json`、`src/lib/settings.ts`、`src/routes/public/douban.ts`（新）、`src/routes/public.ts`、`test/douban.test.ts`（新）

**前台**：`site/src/lib/api.ts`、`site/src/pages/douban.astro`（新）、`site/src/styles/themes/reader.css`、`site/src/styles/themes/normal.css`

**后台**：`admin/src/views/SettingsPage.vue`
