import { cache } from 'react';
import { count, eq } from 'drizzle-orm';
import { db } from '@/db';
import { likes, posts, userProfiles, users } from '@/db/schema';

export const PROFILE_LIMITS = { displayNameMax: 30, bioMax: 200 } as const;

export class ProfileTableMissingError extends Error {
  constructor() {
    super('xhs_user_profiles not available');
  }
}

function isMissingTable(error: unknown): boolean {
  const text = String((error as { message?: string })?.message || error) + String((error as { cause?: unknown })?.cause || '');
  return /no such table/i.test(text);
}

let warned = false;
function warnOnce(error: unknown, what: string) {
  if (!isMissingTable(error)) console.error(`[profiles] ${what} failed:`, error);
  else if (!warned) {
    warned = true;
    console.warn('[profiles] optional tables missing (run drizzle/0006_profiles_image_meta.sql); bio disabled.');
  }
}

export async function getBio(userId: string): Promise<{ bio: string | null; available: boolean }> {
  try {
    const rows = await db.select({ bio: userProfiles.bio }).from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
    return { bio: rows[0]?.bio ?? null, available: true };
  } catch (error) {
    warnOnce(error, 'bio read');
    return { bio: null, available: false };
  }
}

export async function setBio(userId: string, bio: string | null) {
  try {
    await db
      .insert(userProfiles)
      .values({ userId, bio, updatedAt: new Date() })
      .onConflictDoUpdate({ target: userProfiles.userId, set: { bio, updatedAt: new Date() } });
  } catch (error) {
    if (isMissingTable(error)) throw new ProfileTableMissingError();
    throw error;
  }
}

/** 公开资料（不含邮箱、手机号）。用户不存在时返回 null。 */
export const getPublicProfile = cache(async (userId: string) => {
  const rows = await db
    .select({ id: users.id, displayName: users.displayName, photoURL: users.photoURL, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = rows[0];
  if (!user) return null;

  const [bio, postCountRows, likesReceived] = await Promise.all([
    getBio(userId),
    db.select({ n: count() }).from(posts).where(eq(posts.userId, userId)),
    (async () => {
      try {
        const r = await db
          .select({ n: count() })
          .from(likes)
          .innerJoin(posts, eq(likes.postId, posts.id))
          .where(eq(posts.userId, userId));
        return Number(r[0]?.n ?? 0);
      } catch (error) {
        warnOnce(error, 'likes received');
        return 0;
      }
    })(),
  ]);

  return {
    id: user.id,
    displayName: user.displayName,
    photoURL: user.photoURL,
    createdAt: user.createdAt,
    bio: bio.bio,
    bioAvailable: bio.available,
    postCount: Number(postCountRows[0]?.n ?? 0),
    likesReceived,
  };
});

export type PublicProfile = NonNullable<Awaited<ReturnType<typeof getPublicProfile>>>;

/** 用户 id 只允许常见字符（Firebase UID / bot id），防止奇怪的路径 */
export function isPlausibleUserId(id: string): boolean {
  return /^[A-Za-z0-9_\-:.]{1,128}$/.test(id);
}

