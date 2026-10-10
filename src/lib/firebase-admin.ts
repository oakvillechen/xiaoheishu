import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { timingSafeEqual } from 'node:crypto';
import { RATE_LIMITS, rateLimit } from '@/lib/rate-limit';

export class AuthTokenError extends Error {
  status: number;
  retryAfterSec?: number;

  constructor(message: string, status = 401, retryAfterSec?: number) {
    super(message);
    this.name = 'AuthTokenError';
    this.status = status;
    this.retryAfterSec = retryAfterSec;
  }
}

export type RequestIdentity = {
  uid: string;
  /** true = 通过 API_BOT_SECRET 认证的机器人（非管理员，受限流）。 */
  viaBotSecret: boolean;
};

function secureEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** API_BOT_USER_ID 对应的用户永远不是管理员（即使在 ADMIN_USER_IDS 或数据库 role=admin 中）。 */
export function isBotUserId(uid: string): boolean {
  const botUid = String(process.env.API_BOT_USER_ID || '').trim();
  return !!botUid && uid === botUid;
}

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

type FirebaseAdminServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

function parseServiceAccountFromEnv(): FirebaseAdminServiceAccount {
  const rawKey = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!rawKey) {
    throw new Error('Missing FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_KEY');
  }

  try {
    const jsonText = Buffer.from(rawKey, 'base64').toString('utf-8');
    const parsed = JSON.parse(jsonText) as ServiceAccount;

    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      throw new Error('Service account JSON is missing required fields');
    }

    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key.replace(/\\n/g, '\n'),
    };
  } catch (error) {
    throw new Error(`Invalid service account key format: ${String(error)}`);
  }
}

function getFirebaseAdminAuth() {
  if (getApps().length === 0) {
    const serviceAccount = parseServiceAccountFromEnv();
    initializeApp({
      credential: cert(serviceAccount),
    });
  }

  return getAuth();
}

/**
 * 校验请求身份。
 *
 * 1. 正常用户：Authorization: Bearer <Firebase ID Token>
 * 2. 机器人：Authorization: Bearer <API_BOT_SECRET>，身份为 API_BOT_USER_ID。
 *    限制：
 *    - 不能当管理员（所有 admin 接口都会拒绝，见 requireAdmin / isAdminUser）
 *    - 只能以 API_BOT_USER_ID 这个普通用户身份发帖、评论、上传图片
 *    - 受独立限流 RATE_LIMIT_BOT_MAX / RATE_LIMIT_BOT_WINDOW_SEC（默认每小时 300 次请求）
 *    建议以后把这些机器人迁移到 /api/agent/publish（每个 agent 一把独立 Key，并绑定作者）。
 */
export async function verifyRequestIdentity(request: Request): Promise<RequestIdentity> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthTokenError('Missing Authorization Bearer token');
  }

  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) {
    throw new AuthTokenError('Empty Authorization token');
  }

  // --- Bot Secret（受限的机器人身份）---
  const botSecret = String(process.env.API_BOT_SECRET || '').trim();
  if (botSecret && secureEqual(idToken, botSecret)) {
    const botUid = String(process.env.API_BOT_USER_ID || '').trim();
    if (!botUid) {
      throw new AuthTokenError('Server is missing API_BOT_USER_ID configuration', 500);
    }

    const limit = await rateLimit(`bot:${botSecret}`, RATE_LIMITS.bot());
    if (!limit.allowed) {
      throw new AuthTokenError('Bot rate limit exceeded', 429, limit.retryAfterSec);
    }

    return { uid: botUid, viaBotSecret: true };
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(idToken);
    return { uid: decoded.uid, viaBotSecret: false };
  } catch {
    throw new AuthTokenError('Invalid Firebase ID token');
  }
}

/** 兼容旧调用：只返回 uid。 */
export async function verifyFirebaseTokenFromRequest(request: Request): Promise<string> {
  const identity = await verifyRequestIdentity(request);
  return identity.uid;
}

/** 把 AuthTokenError 转成 JSON 响应（401 / 403 / 429 / 500）。 */
export function authErrorResponse(error: AuthTokenError) {
  const headers: Record<string, string> = {};
  if (error.status === 429 && error.retryAfterSec) {
    headers['Retry-After'] = String(error.retryAfterSec);
  }
  return Response.json({ error: error.message }, { status: error.status, headers });
}
