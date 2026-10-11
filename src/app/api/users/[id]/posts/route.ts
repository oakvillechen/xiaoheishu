import { NextResponse } from 'next/server';
import { decodePostCursor, listLatestPosts } from '@/lib/posts-server';
import { isPlausibleUserId } from '@/lib/profiles';

/** GET /api/users/:id/posts?limit=20&cursor=  某用户的笔记（游标分页，格式同 /api/posts） */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = decodeURIComponent((await params).id);
    if (!isPlausibleUserId(id)) return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
    const search = new URL(request.url).searchParams;
    const cursor = search.get('cursor');
    if (cursor && !decodePostCursor(cursor)) return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 });
    const limitParam = Number.parseInt(search.get('limit') || '', 10);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 20;
    return NextResponse.json(await listLatestPosts({ userId: id, cursor, limit }));
  } catch (error) {
    console.error('[users/:id/posts] failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
