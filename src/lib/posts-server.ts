import { cache } from 'react';
import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { comments, posts, users } from '@/db/schema';
import { getImageDisplayUrl } from '@/lib/google-drive';
import { cityMatchValues } from '@/lib/constants/cities';
import { categoryMatchValues } from '@/lib/constants/categories';
import { getCounts } from '@/lib/reactions';

export function parseImageIds(images: string | null): string[] {
  if (!images) return [];
  const normalized = images.trim();
  if (!normalized) return [];
  try {
    const parsed = JSON.parse(normalized) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
    }
    if (typeof parsed === 'string' && parsed.length > 0) return [parsed];
    return [];
  } catch {
    return [normalized];
  }
}

const postSelection = {
  id: posts.id,
  title: posts.title,
  content: posts.content,
  link: posts.link,
  images: posts.images,
  city: posts.city,
  tags: posts.tags,
  category: posts.category,
  userName: users.displayName,
  userImage: users.photoURL,
  createdAt: posts.createdAt,
};

type Row = { images: string | null; createdAt: Date | null };

function withImages<T extends Row>(row: T) {
  const imageIds = parseImageIds(row.images);
  return { ...row, images: imageIds, imageUrls: imageIds.map((value) => getImageDisplayUrl(value)) };
}

export function parsePostId(raw: string): number | null {
  if (!/^\d{1,10}$/.test(raw)) return null;
  const id = Number.parseInt(raw, 10);
  return id > 0 ? id : null;
}

/** 帖子详情 + 评论。帖子不存在时返回 null。用 React cache 让 generateMetadata 和页面共用一次查询。 */
export const getPostDetail = cache(async (postId: number) => {
  const rows = await db
    .select(postSelection)
    .from(posts)
    .leftJoin(users, eq(posts.userId, users.id))
    .where(eq(posts.id, postId))
    .limit(1);
  if (rows.length === 0) return null;

  const postComments = await db
    .select({
      id: comments.id,
      content: comments.content,
      userName: users.displayName,
      userImage: users.photoURL,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.postId, postId))
    .orderBy(desc(comments.createdAt));

  const [likeCounts, favoriteCounts] = await Promise.all([getCounts('like', [postId]), getCounts('favorite', [postId])]);
  return {
    post: {
      ...withImages(rows[0]),
      likeCount: likeCounts.counts.get(postId) ?? 0,
      favoriteCount: favoriteCounts.counts.get(postId) ?? 0,
    },
    comments: postComments,
  };
});

export type PostDetail = NonNullable<Awaited<ReturnType<typeof getPostDetail>>>;

const createdAtKey = sql`coalesce(${posts.createdAt}, 0)`;

/** 城市 / 分类落地页的第一页（游标格式与 /api/posts 一致，客户端可以接着往下翻页） */
export async function listLatestPosts(opts: { city?: string; category?: string; limit?: number }) {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const conditions: SQL[] = [];
  if (opts.city) conditions.push(inArray(sql`lower(trim(${posts.city}))`, cityMatchValues(opts.city)));
  if (opts.category) conditions.push(inArray(sql`lower(trim(${posts.category}))`, categoryMatchValues(opts.category)));
  const rows = await db
    .select(postSelection)
    .from(posts)
    .leftJoin(users, eq(posts.userId, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(createdAtKey), desc(posts.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last
      ? Buffer.from(`${last.createdAt ? Math.floor(last.createdAt.getTime() / 1000) : 0}:${last.id}`).toString('base64url')
      : null;
  return { items: await withLikeCounts(page.map(withImages)), nextCursor };
}

/** sitemap 用：所有帖子 id + 时间 */
export async function listPostIdsForSitemap() {
  return db
    .select({ id: posts.id, createdAt: posts.createdAt })
    .from(posts)
    .orderBy(desc(createdAtKey), desc(posts.id))
    .limit(45000);
}

/** 给帖子列表补上点赞数 likeCount（一次批量查询；点赞表不存在时为 0） */
export async function withLikeCounts<T extends { id: number }>(items: T[]): Promise<(T & { likeCount: number })[]> {
  const { counts } = await getCounts('like', items.map((p) => p.id));
  return items.map((p) => ({ ...p, likeCount: counts.get(p.id) ?? 0 }));
}

/** 按给定 id 顺序取帖子（已删除的帖子会被跳过） */
export async function getPostsByIds(ids: number[]) {
  if (ids.length === 0) return [];
  const rows = await db
    .select(postSelection)
    .from(posts)
    .leftJoin(users, eq(posts.userId, users.id))
    .where(inArray(posts.id, ids));
  const byId = new Map(rows.map((r) => [r.id, withImages(r)]));
  return ids.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
}
