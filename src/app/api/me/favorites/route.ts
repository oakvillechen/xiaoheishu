import { NextResponse } from 'next/server';
import { AuthTokenError, authErrorResponse, verifyRequestIdentity } from '@/lib/firebase-admin';
import { decodeFavoriteCursor, listFavoritePostIds } from '@/lib/reactions';
import { getPostsByIds, withLikeCounts } from '@/lib/posts-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/me/favorites?limit=20&cursor=...
 * 我的收藏，按收藏时间倒序，返回格式与 /api/posts 分页模式一致：{ items, nextCursor, available }
 */
export async function GET(request: Request) {
  try {
    const { uid } = await verifyRequestIdentity(request);
    const params = new URL(request.url).searchParams;
    const limitParam = Number.parseInt(params.get('limit') || '', 10);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 20;
    const cursorParam = params.get('cursor');
    const cursor = decodeFavoriteCursor(cursorParam);
    if (cursorParam && !cursor) {
      return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 });
    }

    const { postIds, nextCursor, available } = await listFavoritePostIds(uid, limit, cursor);
    const items = await withLikeCounts(await getPostsByIds(postIds));
    return NextResponse.json({ items, nextCursor, available }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthTokenError) return authErrorResponse(error);
    console.error('[me/favorites] failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
