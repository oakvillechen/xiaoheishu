import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { AuthTokenError, authErrorResponse, verifyFirebaseTokenFromRequest } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

type UpdateProfileBody = {
  displayName?: unknown;
  photoURL?: unknown;
  email?: unknown;
  phoneNumber?: unknown;
  city?: unknown;
};

function normalizeOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export async function GET(request: Request) {
  try {
    const uid = await verifyFirebaseTokenFromRequest(request);

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
      .where(eq(users.id, uid))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: rows[0] });
  } catch (error) {
    if (error instanceof AuthTokenError) {
      return authErrorResponse(error);
    }

    console.error('Failed to get profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const uid = await verifyFirebaseTokenFromRequest(request);
    const body = (await request.json()) as UpdateProfileBody;

    const displayName = normalizeOptionalString(body.displayName);
    const photoURL = normalizeOptionalString(body.photoURL);
    const phoneNumber = normalizeOptionalString(body.phoneNumber);
    const city = normalizeOptionalString(body.city);

    if (displayName !== undefined && displayName !== null && displayName.length > 60) {
      return NextResponse.json({ error: 'displayName is too long' }, { status: 400 });
    }

    if (photoURL !== undefined && photoURL !== null && photoURL.length > 1000) {
      return NextResponse.json({ error: 'photoURL is too long' }, { status: 400 });
    }

    // 邮箱以 Firebase 登录账号为准，不允许通过此接口修改（防止冒用管理员邮箱等）。
    // 为兼容旧调用方，传了 email 不报错，只是忽略，并在响应里注明。
    const ignoredFields = body.email !== undefined ? ['email'] : [];

    if (phoneNumber !== undefined && phoneNumber !== null && phoneNumber.length > 30) {
      return NextResponse.json({ error: 'phoneNumber is too long' }, { status: 400 });
    }

    if (city !== undefined && city !== null && city.length > 80) {
      return NextResponse.json({ error: 'city is too long' }, { status: 400 });
    }

    const updatePayload: Record<string, string | null> = {};
    if (displayName !== undefined) updatePayload.displayName = displayName;
    if (photoURL !== undefined) updatePayload.photoURL = photoURL;
    if (phoneNumber !== undefined) updatePayload.phoneNumber = phoneNumber;
    if (city !== undefined) updatePayload.city = city;

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No profile fields to update', ignoredFields }, { status: 400 });
    }

    const updated = await db
      .update(users)
      .set(updatePayload)
      .where(eq(users.id, uid))
      .returning({
        id: users.id,
        role: users.role,
        displayName: users.displayName,
        photoURL: users.photoURL,
        email: users.email,
        phoneNumber: users.phoneNumber,
        city: users.city,
      });

    if (updated.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, user: updated[0], ignoredFields });
  } catch (error) {
    if (error instanceof AuthTokenError) {
      return authErrorResponse(error);
    }

    console.error('Failed to update profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
