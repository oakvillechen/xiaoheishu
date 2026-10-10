import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { AuthTokenError, isBotUserId, verifyRequestIdentity } from '@/lib/firebase-admin';

function parseAdminUserIdsFromEnv(): Set<string> {
  const raw = String(process.env.ADMIN_USER_IDS || '').trim();
  if (!raw) {
    return new Set();
  }

  return new Set(
    raw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );
}

export function isBootstrapAdminUser(uid: string): boolean {
  if (isBotUserId(uid)) {
    return false;
  }
  return parseAdminUserIdsFromEnv().has(uid);
}

export async function getUserRole(uid: string): Promise<string | null> {
  const rows = await db
    .select({
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, uid))
    .limit(1);

  return rows[0]?.role || null;
}

export async function isAdminUser(uid: string): Promise<boolean> {
  // 机器人账号（API_BOT_USER_ID）永远不是管理员
  if (isBotUserId(uid)) {
    return false;
  }

  if (isBootstrapAdminUser(uid)) {
    return true;
  }

  const role = await getUserRole(uid);
  return role === 'admin';
}

/**
 * 管理员接口统一入口：必须是 Firebase 登录的管理员。
 * 通过 API_BOT_SECRET 认证的请求一律 403。
 */
export async function requireAdmin(request: Request): Promise<string> {
  const identity = await verifyRequestIdentity(request);
  if (identity.viaBotSecret) {
    throw new AuthTokenError('Bot credentials cannot perform admin actions', 403);
  }
  if (!(await isAdminUser(identity.uid))) {
    throw new AuthTokenError('Admin permission required', 403);
  }
  return identity.uid;
}
