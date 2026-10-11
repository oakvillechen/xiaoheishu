import { NextResponse } from 'next/server';
import { getPublicProfile, isPlausibleUserId } from '@/lib/profiles';

/** GET /api/users/:id 公开资料（头像、昵称、简介、笔记数、获赞数） */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = decodeURIComponent((await params).id);
    if (!isPlausibleUserId(id)) return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
    const profile = await getPublicProfile(id);
    if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    return NextResponse.json({ profile });
  } catch (error) {
    console.error('[users/:id] failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
