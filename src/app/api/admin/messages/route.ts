import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { userMessages, users } from '@/db/schema';
import { AuthTokenError, authErrorResponse } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/user-access';
import { adminMessageSchema, parseJsonBody } from '@/lib/validation';
import { RATE_LIMITS, rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const uid = await requireAdmin(request);

    const limit = await rateLimit(uid, RATE_LIMITS.adminMessage());
    if (!limit.allowed) {
      return rateLimitResponse(limit);
    }

    const parsed = await parseJsonBody(request, adminMessageSchema);
    if (!parsed.ok) {
      return parsed.response;
    }
    const { toUserId, title, content } = parsed.data;

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
      return authErrorResponse(error);
    }

    console.error('Failed to send admin message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
