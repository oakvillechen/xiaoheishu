import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { userMessages, users } from '@/db/schema';
import { AuthTokenError, verifyFirebaseTokenFromRequest } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const uid = await verifyFirebaseTokenFromRequest(request);

    const messages = await db
      .select({
        id: userMessages.id,
        title: userMessages.title,
        content: userMessages.content,
        createdAt: userMessages.createdAt,
        readAt: userMessages.readAt,
        fromUserId: userMessages.fromUserId,
        fromUserName: users.displayName,
      })
      .from(userMessages)
      .leftJoin(users, eq(userMessages.fromUserId, users.id))
      .where(eq(userMessages.toUserId, uid))
      .orderBy(desc(userMessages.createdAt));

    return NextResponse.json({ messages });
  } catch (error) {
    if (error instanceof AuthTokenError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    console.error('Failed to fetch messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const uid = await verifyFirebaseTokenFromRequest(request);

    const updated = await db
      .update(userMessages)
      .set({
        readAt: new Date(),
      })
      .where(eq(userMessages.toUserId, uid))
      .returning({
        id: userMessages.id,
      });

    return NextResponse.json({ ok: true, updatedCount: updated.length });
  } catch (error) {
    if (error instanceof AuthTokenError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    console.error('Failed to mark messages as read:', error);
    return NextResponse.json({ error: 'Failed to mark messages as read' }, { status: 500 });
  }
}
