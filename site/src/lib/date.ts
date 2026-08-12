// 日期格式化工具（统一各页面的日期展示，避免 SSR/客户端时区不一致）
// 所有函数均用本地时区的显式拼接，不依赖 toLocaleDateString 的运行时区域。

/** 文章列表 / 归档：YYYY/MM/DD */
export function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

/** 首页时间线月份-日：MM-DD */
export function fmtMonthDay(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 说说等带时分的场景：YYYY-MM-DD HH:MM */
export function fmtDateTime(ts: number): string {
  const d = new Date(ts);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${date} ${time}`;
}
