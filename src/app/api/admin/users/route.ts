import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { AuthTokenError, authErrorResponse } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/user-access';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

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
      return authErrorResponse(error);
    }

    console.error('Failed to fetch users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
