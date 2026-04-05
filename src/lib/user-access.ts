import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';

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
  if (isBootstrapAdminUser(uid)) {
    return true;
  }

  const role = await getUserRole(uid);
  return role === 'admin';
}
