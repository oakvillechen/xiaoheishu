/** 瀑布流布局工具（纯函数，服务端和浏览器结果一致） */

/** 封面显示比例（高/宽）：按原图比例，限制在 3:4（横图）到 4:3（竖图）之间，和小红书一致；未知时按 3:4 竖图 */
export const DEFAULT_COVER_RATIO = 4 / 3;
export const MIN_COVER_RATIO = 3 / 4;
export const MAX_COVER_RATIO = 4 / 3;
export const TEXT_ONLY_RATIO = 1;

export function coverRatio(width?: number | null, height?: number | null): number {
  if (!width || !height) return DEFAULT_COVER_RATIO;
  return Math.min(MAX_COVER_RATIO, Math.max(MIN_COVER_RATIO, height / width));
}

type Item = { id: number; title: string; imageUrls?: string[]; coverWidth?: number | null; coverHeight?: number | null };

/** 估算卡片高度（以列宽为 1）：封面 + 标题行数 + 作者栏 */
function estimateHeight(post: Item): number {
  const media = post.imageUrls?.length ? coverRatio(post.coverWidth, post.coverHeight) : TEXT_ONLY_RATIO;
  const titleLines = Array.from(post.title || '').length > 11 ? 2 : 1;
  return media + 0.1 + titleLines * 0.11 + 0.18;
}

/**
 * 依次把每张卡片放进当前最矮的一列。
 * 只依赖帖子顺序和估算高度，所以无限滚动追加新帖子时，前面的卡片位置不会变（不会跳动）。
 */
export function distributeColumns<T extends Item>(posts: T[], columnCount: number): T[][] {
  const n = Math.max(1, columnCount);
  const columns: T[][] = Array.from({ length: n }, () => []);
  const heights = new Array<number>(n).fill(0);
  for (const post of posts) {
    let target = 0;
    for (let i = 1; i < n; i++) if (heights[i] < heights[target] - 1e-9) target = i;
    columns[target].push(post);
    heights[target] += estimateHeight(post);
  }
  return columns;
}
