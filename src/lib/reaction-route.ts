import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { posts } from '@/db/schema';
import { AuthTokenError, authErrorResponse, verifyRequestIdentity } from '@/lib/firebase-admin';
import { RATE_LIMITS, rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import {
  ReactionsUnavailableError,
  addReaction,
  getReactionState,
  removeReaction,
  type ReactionKind,
} from '@/lib/reactions';

type Ctx = { params: Promise<{ id: string }> };

const LABEL: Record<ReactionKind, string> = { like: '点赞', favorite: '收藏' };

function parseId(raw: string): number | null {
  if (!/^\d{1,10}$/.test(raw)) return null;
  const id = Number.parseInt(raw, 10);
  return id > 0 ? id : null;
}

/** 有 Authorization 头时尝试识别用户；没有或无效时当作游客（GET 不强制登录） */
export async function optionalUserId(request: Request): Promise<string | null> {
  if (!request.headers.get('authorization')) return null;
  try {
    return (await verifyRequestIdentity(request)).uid;
  } catch (error) {
    if (error instanceof AuthTokenError && error.status === 429) throw error;
    return null;
  }
}

async function postExists(postId: number) {
  const rows = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId)).limit(1);
  return rows.length > 0;
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

/** GET / POST / DELETE /api/posts/:id/{like|favorite} */
export function reactionHandlers(kind: ReactionKind) {
  async function GET(request: Request, { params }: Ctx) {
    try {
      const postId = parseId((await params).id);
      if (!postId) return json({ error: 'Invalid post id' }, 400);
      const userId = await optionalUserId(request);
      const state = await getReactionState(kind, postId, userId);
      return json({ postId, ...state, loggedIn: Boolean(userId) });
    } catch (error) {
      if (error instanceof AuthTokenError) return authErrorResponse(error);
      console.error(`[${kind}] GET failed:`, error);
      return json({ error: 'Internal Server Error' }, 500);
    }
  }

  async function mutate(request: Request, { params }: Ctx, action: 'add' | 'remove') {
    try {
      const postId = parseId((await params).id);
      if (!postId) return json({ error: 'Invalid post id' }, 400);

      // 必须登录（Firebase ID Token；API_BOT_SECRET 机器人身份也可以，但受 bot 总限流）
      const { uid } = await verifyRequestIdentity(request);

      const limit = await rateLimit(uid, RATE_LIMITS.reaction());
      if (!limit.allowed) return rateLimitResponse(limit);

      if (!(await postExists(postId))) return json({ error: 'Post not found' }, 404);

      if (action === 'add') await addReaction(kind, uid, postId);
      else await removeReaction(kind, uid, postId);

      const state = await getReactionState(kind, postId, uid);
      return json({ postId, ...state, loggedIn: true });
    } catch (error) {
      if (error instanceof AuthTokenError) return authErrorResponse(error);
      if (error instanceof ReactionsUnavailableError) {
        return json({ error: `${LABEL[kind]}功能暂未开放，请稍后再试`, available: false }, 503);
      }
      console.error(`[${kind}] ${action} failed:`, error);
      return json({ error: 'Internal Server Error' }, 500);
    }
  }

  return {
    GET,
    POST: (request: Request, ctx: Ctx) => mutate(request, ctx, 'add'),
    DELETE: (request: Request, ctx: Ctx) => mutate(request, ctx, 'remove'),
  };
}
