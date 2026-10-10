import { NextResponse } from 'next/server';
import { AuthTokenError, authErrorResponse, verifyRequestIdentity } from '@/lib/firebase-admin';
import { getUserActive } from '@/lib/reactions';

export const dynamic = 'force-dynamic';

const MAX_IDS = 60;

/**
 * GET /api/me/reactions?postIds=1,2,3
 * 当前登录用户在这些帖子里点赞 / 收藏过哪些（首页卡片批量查询，避免每张卡片单独请求）。
 */
export async function GET(request: Request) {
  try {
    const { uid } = await verifyRequestIdentity(request);
    const raw = new URL(request.url).searchParams.get('postIds') || '';
    const ids = raw
      .split(',')
      .map((v) => Number.parseInt(v.trim(), 10))
      .filter((n) => Number.isInteger(n) && n > 0)
      .slice(0, MAX_IDS);

    const [liked, favorited] = await Promise.all([getUserActive('like', uid, ids), getUserActive('favorite', uid, ids)]);
    return NextResponse.json(
      {
        liked: Array.from(liked.active),
        favorited: Array.from(favorited.active),
        available: liked.available && favorited.available,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    if (error instanceof AuthTokenError) return authErrorResponse(error);
    console.error('[me/reactions] failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
