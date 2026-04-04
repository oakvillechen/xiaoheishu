import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { AuthTokenError, verifyFirebaseTokenFromRequest } from '@/lib/firebase-admin';

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

    await db
      .insert(users)
      .values({
        id: userId,
        email,
        displayName,
        photoURL,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email,
          displayName,
          photoURL,
        },
      });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthTokenError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    console.error('Auth sync failed:', error);
    return NextResponse.json({ error: 'Failed to sync user' }, { status: 500 });
  }
}
