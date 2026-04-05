import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { AuthTokenError, verifyFirebaseTokenFromRequest } from '@/lib/firebase-admin';
import { isBootstrapAdminUser } from '@/lib/user-access';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const uid = await verifyFirebaseTokenFromRequest(request);
    const body = await request.json();

    const userId = String(body.userId || '').trim();
    const email = String(body.email || '').trim();
    const displayName = body.displayName ? String(body.displayName) : null;
    const photoURL = body.photoURL ? String(body.photoURL) : null;

    if (!userId || !email) {
      return NextResponse.json({ error: 'Missing userId or email' }, { status: 400 });
    }

    if (uid !== userId) {
      return NextResponse.json({ error: 'Forbidden userId' }, { status: 403 });
    }

    const existingRows = await db
      .select({
        id: users.id,
        role: users.role,
        email: users.email,
        displayName: users.displayName,
        photoURL: users.photoURL,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const existing = existingRows[0];
    const role = isBootstrapAdminUser(userId) ? 'admin' : (existing?.role || 'user');

    await db
      .insert(users)
      .values({
        id: userId,
        role,
        email: existing?.email || email,
        displayName: existing?.displayName || displayName,
        photoURL: existing?.photoURL || photoURL,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          role,
          email: existing?.email || email,
          displayName: existing?.displayName || displayName,
          photoURL: existing?.photoURL || photoURL,
        },
      });

    return NextResponse.json({ ok: true, role });
  } catch (error) {
    if (error instanceof AuthTokenError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    console.error('Auth sync failed:', error);
    return NextResponse.json({ error: 'Failed to sync user' }, { status: 500 });
  }
}
