import { NextResponse } from 'next/server';
import { db } from '@/db';
import { comments } from '@/db/schema';
import { AuthTokenError, verifyFirebaseTokenFromRequest } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const uid = await verifyFirebaseTokenFromRequest(req);
    const { postId, content, userId } = await req.json();

    if (!postId || !content || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (uid !== userId) {
      return NextResponse.json({ error: 'Forbidden userId' }, { status: 403 });
    }

    const newComment = await db.insert(comments).values({
      postId,
      content,
      userId,
    }).returning();

    return NextResponse.json(newComment[0]);
  } catch (error) {
    if (error instanceof AuthTokenError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
