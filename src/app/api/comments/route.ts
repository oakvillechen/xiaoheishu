import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { comments, posts } from '@/db/schema';
import { AuthTokenError, authErrorResponse, verifyFirebaseTokenFromRequest } from '@/lib/firebase-admin';
import { createCommentSchema, parseJsonBody } from '@/lib/validation';
import { RATE_LIMITS, rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const uid = await verifyFirebaseTokenFromRequest(req);

    const parsed = await parseJsonBody(req, createCommentSchema);
    if (!parsed.ok) {
      return parsed.response;
    }
    const { postId, content, userId } = parsed.data;

    if (uid !== userId) {
      return NextResponse.json({ error: 'Forbidden userId' }, { status: 403 });
    }

    const limit = await rateLimit(uid, RATE_LIMITS.comment());
    if (!limit.allowed) {
      return rateLimitResponse(limit);
    }

    const target = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId)).limit(1);
    if (target.length === 0) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const newComment = await db.insert(comments).values({
      postId,
      content,
      userId,
    }).returning();

    return NextResponse.json(newComment[0]);
  } catch (error) {
    if (error instanceof AuthTokenError) {
      return authErrorResponse(error);
    }

    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
