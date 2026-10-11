import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { revalidatePath } from 'next/cache';
import { AuthTokenError, authErrorResponse, verifyFirebaseTokenFromRequest } from '@/lib/firebase-admin';
import { isAllowedImageRef } from '@/lib/image-refs';
import { PROFILE_LIMITS, ProfileTableMissingError, getBio, setBio } from '@/lib/profiles';
import { RATE_LIMITS, rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export const runtime = 'nodejs';

type UpdateProfileBody = {
  displayName?: unknown;
  photoURL?: unknown;
  email?: unknown;
  phoneNumber?: unknown;
  city?: unknown;
  bio?: unknown;
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

    const bio = await getBio(uid);
    return NextResponse.json({ user: { ...rows[0], bio: bio.bio }, bioAvailable: bio.available });
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

    const limit = await rateLimit(uid, RATE_LIMITS.profile());
    if (!limit.allowed) {
      return rateLimitResponse(limit);
    }

    if (displayName === null) {
      return NextResponse.json({ error: '昵称不能为空', field: 'displayName' }, { status: 400 });
    }
    if (displayName !== undefined && Array.from(displayName).length > PROFILE_LIMITS.displayNameMax) {
      return NextResponse.json({ error: `昵称不能超过 ${PROFILE_LIMITS.displayNameMax} 个字`, field: 'displayName' }, { status: 400 });
    }
    if (displayName !== undefined && /[<>\u0000-\u001f]/.test(displayName)) {
      return NextResponse.json({ error: '昵称包含不允许的字符', field: 'displayName' }, { status: 400 });
    }

    // 头像：只接受本站上传的图片（Cloudinary / 站内路径）；不改动时可以原样传回现有头像（例如 Google 头像）
    if (photoURL !== undefined && photoURL !== null && !isAllowedImageRef(photoURL)) {
      const current = await db.select({ photoURL: users.photoURL }).from(users).where(eq(users.id, uid)).limit(1);
      if (current[0]?.photoURL !== photoURL) {
        return NextResponse.json({ error: '头像只能使用本站上传的图片', field: 'photoURL' }, { status: 400 });
      }
    }

    let bio: string | null | undefined;
    if (body.bio !== undefined) {
      if (body.bio !== null && typeof body.bio !== 'string') {
        return NextResponse.json({ error: '简介格式不正确', field: 'bio' }, { status: 400 });
      }
      bio = typeof body.bio === 'string' ? body.bio.replace(/\r\n/g, '\n').trim() || null : null;
      if (bio && Array.from(bio).length > PROFILE_LIMITS.bioMax) {
        return NextResponse.json({ error: `简介不能超过 ${PROFILE_LIMITS.bioMax} 个字`, field: 'bio' }, { status: 400 });
      }
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

    if (Object.keys(updatePayload).length === 0 && bio === undefined) {
      return NextResponse.json({ error: 'No profile fields to update', ignoredFields }, { status: 400 });
    }

    if (bio !== undefined) {
      try {
        await setBio(uid, bio);
      } catch (error) {
        if (error instanceof ProfileTableMissingError) {
          // 简介表还没建：其它字段照常保存，简介忽略
          ignoredFields.push('bio');
        } else {
          throw error;
        }
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      revalidatePath(`/u/${encodeURIComponent(uid)}`);
      return NextResponse.json({ ok: true, ignoredFields });
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

    // 资料页和帖子页显示作者昵称/头像，刷新缓存
    revalidatePath(`/u/${encodeURIComponent(uid)}`);
    revalidatePath('/posts/[id]', 'page');
    return NextResponse.json({ ok: true, user: updated[0], ignoredFields });
  } catch (error) {
    if (error instanceof AuthTokenError) {
      return authErrorResponse(error);
    }

    console.error('Failed to update profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
