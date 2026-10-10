import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { favorites, likes } from '@/db/schema';

/**
 * 点赞 / 收藏。
 *
 * 依赖表 xhs_likes / xhs_favorites（drizzle/0005_likes_favorites.sql）。
 * 表还没建时所有读操作返回 0 / 未点赞，写操作抛 ReactionsUnavailableError（接口返回 503），
 * 网站其它功能不受影响 —— 可以先合并代码，再执行迁移。
 *
 * 不在 xhs_posts 上加冗余计数列：那样需要 ALTER TABLE，迁移执行前查询帖子会直接报错；
 * 用 post_id 索引上的 count(*) 在当前数据量下足够快，Turso 读取量也很小。
 */

export type ReactionKind = 'like' | 'favorite';

export class ReactionsUnavailableError extends Error {
  constructor() {
    super('Reactions tables are not available yet');
  }
}

const tables = { like: likes, favorite: favorites } as const;

let warned = false;
function isMissingTable(error: unknown): boolean {
  const text = String((error as { message?: string })?.message || error) + String((error as { cause?: unknown })?.cause || '');
  return /no such table/i.test(text);
}

function handleReadError(error: unknown) {
  if (!isMissingTable(error)) {
    console.error('[reactions] read failed:', error);
  } else if (!warned) {
    warned = true;
    console.warn('[reactions] xhs_likes / xhs_favorites not found; run drizzle/0005_likes_favorites.sql. Falling back to zero counts.');
  }
}

/** 批量统计点赞 / 收藏数。表不存在或查询失败时返回空 Map（即全部 0）。 */
export async function getCounts(kind: ReactionKind, postIds: number[]): Promise<{ counts: Map<number, number>; available: boolean }> {
  const counts = new Map<number, number>();
  const ids = Array.from(new Set(postIds)).filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) return { counts, available: true };
  const table = tables[kind];
  try {
    const rows = await db
      .select({ postId: table.postId, n: count() })
      .from(table)
      .where(inArray(table.postId, ids))
      .groupBy(table.postId);
    for (const row of rows) counts.set(row.postId, Number(row.n));
    return { counts, available: true };
  } catch (error) {
    handleReadError(error);
    return { counts, available: false };
  }
}

/** 当前用户在这些帖子里点过赞 / 收藏过的 id 集合 */
export async function getUserActive(kind: ReactionKind, userId: string, postIds: number[]): Promise<{ active: Set<number>; available: boolean }> {
  const active = new Set<number>();
  const ids = Array.from(new Set(postIds)).filter((id) => Number.isInteger(id) && id > 0);
  if (!userId || ids.length === 0) return { active, available: true };
  const table = tables[kind];
  try {
    const rows = await db
      .select({ postId: table.postId })
      .from(table)
      .where(and(eq(table.userId, userId), inArray(table.postId, ids)));
    for (const row of rows) active.add(row.postId);
    return { active, available: true };
  } catch (error) {
    handleReadError(error);
    return { active, available: false };
  }
}

export type ReactionState = { count: number; active: boolean; available: boolean };

export async function getReactionState(kind: ReactionKind, postId: number, userId: string | null): Promise<ReactionState> {
  const [{ counts, available }, mine] = await Promise.all([
    getCounts(kind, [postId]),
    userId ? getUserActive(kind, userId, [postId]) : Promise.resolve({ active: new Set<number>(), available: true }),
  ]);
  return { count: counts.get(postId) ?? 0, active: mine.active.has(postId), available: available && mine.available };
}

/** 点赞 / 收藏（幂等：重复调用不会重复计数） */
export async function addReaction(kind: ReactionKind, userId: string, postId: number) {
  const table = tables[kind];
  try {
    await db.insert(table).values({ userId, postId, createdAt: new Date() }).onConflictDoNothing();
  } catch (error) {
    if (isMissingTable(error)) throw new ReactionsUnavailableError();
    throw error;
  }
}

/** 取消点赞 / 收藏（幂等） */
export async function removeReaction(kind: ReactionKind, userId: string, postId: number) {
  const table = tables[kind];
  try {
    await db.delete(table).where(and(eq(table.userId, userId), eq(table.postId, postId)));
  } catch (error) {
    if (isMissingTable(error)) throw new ReactionsUnavailableError();
    throw error;
  }
}

/** 删除帖子时一并清理点赞 / 收藏。表不存在时忽略。 */
export async function deleteReactionsForPost(postId: number) {
  for (const table of [likes, favorites]) {
    try {
      await db.delete(table).where(eq(table.postId, postId));
    } catch (error) {
      if (!isMissingTable(error)) throw error;
    }
  }
}

type FavoriteCursor = { at: number; postId: number };

export function encodeFavoriteCursor(cursor: FavoriteCursor) {
  return Buffer.from(`${cursor.at}:${cursor.postId}`).toString('base64url');
}

export function decodeFavoriteCursor(raw: string | null): FavoriteCursor | null {
  if (!raw) return null;
  try {
    const [at, postId] = Buffer.from(raw, 'base64url').toString('utf8').split(':').map((v) => Number.parseInt(v, 10));
    if (Number.isFinite(at) && Number.isFinite(postId)) return { at, postId };
  } catch {
    // ignore
  }
  return null;
}

/** 某用户的收藏（按收藏时间倒序），返回 post id 列表和下一页游标 */
export async function listFavoritePostIds(userId: string, limit: number, cursor: FavoriteCursor | null) {
  const atKey = sql`coalesce(${favorites.createdAt}, 0)`;
  try {
    const rows = await db
      .select({ postId: favorites.postId, createdAt: favorites.createdAt })
      .from(favorites)
      .where(
        and(
          eq(favorites.userId, userId),
          cursor ? sql`(${atKey} < ${cursor.at} or (${atKey} = ${cursor.at} and ${favorites.postId} < ${cursor.postId}))` : undefined,
        ),
      )
      .orderBy(desc(atKey), desc(favorites.postId))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeFavoriteCursor({ at: last.createdAt ? Math.floor(last.createdAt.getTime() / 1000) : 0, postId: last.postId })
        : null;
    return { postIds: page.map((r) => r.postId), nextCursor, available: true };
  } catch (error) {
    handleReadError(error);
    return { postIds: [] as number[], nextCursor: null, available: false };
  }
}
