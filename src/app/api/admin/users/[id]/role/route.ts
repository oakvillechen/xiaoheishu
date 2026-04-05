import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { AuthTokenError, verifyFirebaseTokenFromRequest } from '@/lib/firebase-admin';
import { isAdminUser } from '@/lib/user-access';

export const runtime = 'nodejs';

type UpdateRoleBody = {
  role?: unknown;
};

function normalizeRole(value: unknown): 'admin' | 'user' | '' {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'admin' || normalized === 'user') {
    return normalized;
  }

  return '';
}

export async function PATCH(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  try {
    const uid = await verifyFirebaseTokenFromRequest(request);
    if (!(await isAdminUser(uid))) {
      return NextResponse.json({ error: 'Admin permission required' }, { status: 403 });
    }

    const params = await paramsPromise;
    const targetUserId = String(params.id || '').trim();
    if (!targetUserId) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
    }

    const body = (await request.json()) as UpdateRoleBody;
    const role = normalizeRole(body.role);

    if (!role) {
      return NextResponse.json({ error: 'Invalid role. Expected admin or user' }, { status: 400 });
    }

    const updated = await db
      .update(users)
      .set({ role })
      .where(eq(users.id, targetUserId))
      .returning({
        id: users.id,
        role: users.role,
      });

    if (updated.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, user: updated[0] });
  } catch (error) {
    if (error instanceof AuthTokenError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    console.error('Failed to update user role:', error);
    return NextResponse.json({ error: 'Failed to update user role' }, { status: 500 });
  }
}
