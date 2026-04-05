import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { userMessages, users } from '@/db/schema';
import { AuthTokenError, verifyFirebaseTokenFromRequest } from '@/lib/firebase-admin';
import { isAdminUser } from '@/lib/user-access';

export const runtime = 'nodejs';

type SendMessageBody = {
  toUserId?: unknown;
  title?: unknown;
  content?: unknown;
};

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: Request) {
  try {
    const uid = await verifyFirebaseTokenFromRequest(request);

    if (!(await isAdminUser(uid))) {
      return NextResponse.json({ error: 'Admin permission required' }, { status: 403 });
    }

    const body = (await request.json()) as SendMessageBody;
    const toUserId = normalizeString(body.toUserId);
    const title = normalizeString(body.title);
    const content = normalizeString(body.content);

    if (!toUserId || !title || !content) {
      return NextResponse.json({ error: 'Missing required fields: toUserId, title, content' }, { status: 400 });
    }

    if (title.length > 120) {
      return NextResponse.json({ error: 'title is too long' }, { status: 400 });
    }

    if (content.length > 2000) {
      return NextResponse.json({ error: 'content is too long' }, { status: 400 });
    }

    const targetUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, toUserId))
      .limit(1);

    if (targetUser.length === 0) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    const inserted = await db
      .insert(userMessages)
      .values({
        toUserId,
        fromUserId: uid,
        title,
        content,
      })
      .returning();

    return NextResponse.json({ ok: true, message: inserted[0] });
  } catch (error) {
    if (error instanceof AuthTokenError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    console.error('Failed to send admin message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
