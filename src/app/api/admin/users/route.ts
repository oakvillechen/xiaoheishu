import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { AuthTokenError, verifyFirebaseTokenFromRequest } from '@/lib/firebase-admin';
import { isAdminUser } from '@/lib/user-access';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const uid = await verifyFirebaseTokenFromRequest(request);

    if (!(await isAdminUser(uid))) {
      return NextResponse.json({ error: 'Admin permission required' }, { status: 403 });
    }

    const rows = await db
      .select({
        id: users.id,
        role: users.role,
        displayName: users.displayName,
        photoURL: users.photoURL,
        email: users.email,
        phoneNumber: users.phoneNumber,
        city: users.city,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    return NextResponse.json({ users: rows });
  } catch (error) {
    if (error instanceof AuthTokenError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    console.error('Failed to fetch users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
