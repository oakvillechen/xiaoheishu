import { NextResponse } from 'next/server';
import { count, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { deleteReactionsForPost } from '@/lib/reactions';
import { db } from '@/db';
import { adminAuditLog, comments, posts } from '@/db/schema';
import { authenticateAgentAdmin } from '@/lib/agent-admin-auth';
import { RATE_LIMITS, rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { agentAdminPatchSchema, parseJsonBody } from '@/lib/validation';

export const runtime = 'nodejs';

/**
 * 维护接口（需要 AGENT_ADMIN_API_KEY，未配置时 404）
 *
 * PATCH  /api/agent/admin/posts/:id   body: { title?, content?, images?, dryRun? }
 * DELETE /api/agent/admin/posts/:id?dryRun=false&force=true
 *
 * dryRun 默认 true：只返回 before / after，不写库。传 dryRun=false 才真正执行。
 */

type RouteContext = { params: Promise<{ id: string }> };

function parseImages(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string');
    if (typeof parsed === 'string') return [parsed];
  } catch {
    // 兼容旧数据：直接存了单个字符串
  }
  return [raw];
}

async function loadPost(postId: number) {
  const rows = await db
    .select({ id: posts.id, title: posts.title, content: posts.content, images: posts.images, userId: posts.userId })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { ...row, images: parseImages(row.images) };
}

async function countComments(postId: number): Promise<number> {
  const rows = await db.select({ n: count() }).from(comments).where(eq(comments.postId, postId));
  return Number(rows[0]?.n ?? 0);
}

async function audit(entry: {
  action: 'patch-post' | 'delete-post';
  postId: number;
  actor: string;
  dryRun: boolean;
  before: unknown;
  after: unknown;
}) {
  console.info(
    `[agent-admin] ${entry.action} post=${entry.postId} actor=${entry.actor} dryRun=${entry.dryRun}`,
    JSON.stringify({ before: entry.before, after: entry.after }).slice(0, 2000),
  );
  if (entry.dryRun) return;
  try {
    await db.insert(adminAuditLog).values({
      action: entry.action,
      postId: entry.postId,
      actor: entry.actor,
      dryRun: entry.dryRun,
      before: JSON.stringify(entry.before),
      after: JSON.stringify(entry.after),
    });
  } catch (error) {
    // 日志表还没建（未执行 0004 迁移）时只打 console，不影响操作
    console.warn('[agent-admin] audit log table unavailable (apply drizzle/0004_admin_audit_log.sql):', String(error));
  }
}

function parseBool(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback;
  const v = value.trim().toLowerCase();
  if (['false', '0', 'no'].includes(v)) return false;
  if (['true', '1', 'yes'].includes(v)) return true;
  return fallback;
}

async function guard(request: Request, context: RouteContext) {
  const auth = authenticateAgentAdmin(request);
  if (!auth.ok) {
    return { response: NextResponse.json({ error: auth.error }, { status: auth.status }) } as const;
  }

  const limit = await rateLimit(`agent-admin:${auth.apiKey}`, RATE_LIMITS.agentAdmin());
  if (!limit.allowed) {
    return { response: rateLimitResponse(limit) } as const;
  }

  const { id } = await context.params;
  const postId = Number.parseInt(id, 10);
  if (!Number.isFinite(postId) || postId <= 0 || String(postId) !== id.trim()) {
    return { response: NextResponse.json({ error: 'Invalid post id' }, { status: 400 }) } as const;
  }

  return { actor: auth.actor, postId } as const;
}

export async function PATCH(request: Request, context: RouteContext) {
  const g = await guard(request, context);
  if ('response' in g) return g.response;

  try {
    const parsed = await parseJsonBody(request, agentAdminPatchSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const urlDryRun = new URL(request.url).searchParams.get('dryRun');
    const dryRun = body.dryRun ?? parseBool(urlDryRun, true);

    const before = await loadPost(g.postId);
    if (!before) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const after = {
      ...before,
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.content !== undefined ? { content: body.content } : {}),
      ...(body.images !== undefined ? { images: body.images } : {}),
    };
    const changedFields = (['title', 'content', 'images'] as const).filter(
      (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]),
    );

    if (!dryRun && changedFields.length > 0) {
      await db
        .update(posts)
        .set({
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.content !== undefined ? { content: body.content } : {}),
          ...(body.images !== undefined ? { images: JSON.stringify(body.images) } : {}),
        })
        .where(eq(posts.id, g.postId));
      revalidatePath('/');
      revalidatePath(`/posts/${g.postId}`);
    }

    await audit({ action: 'patch-post', postId: g.postId, actor: g.actor, dryRun, before, after });

    return NextResponse.json({ ok: true, dryRun, applied: !dryRun && changedFields.length > 0, changedFields, before, after });
  } catch (error) {
    console.error('[agent-admin] patch failed:', error);
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const g = await guard(request, context);
  if ('response' in g) return g.response;

  try {
    const params = new URL(request.url).searchParams;
    const dryRun = parseBool(params.get('dryRun'), true);
    const force = parseBool(params.get('force'), false);

    const before = await loadPost(g.postId);
    if (!before) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const commentCount = await countComments(g.postId);
    if (commentCount > 0 && !force) {
      return NextResponse.json(
        { error: `该帖子有 ${commentCount} 条评论，默认不删除；确认要连评论一起删请加 force=true`, commentCount },
        { status: 409 },
      );
    }

    if (!dryRun) {
      if (commentCount > 0) {
        await db.delete(comments).where(eq(comments.postId, g.postId));
      }
      await deleteReactionsForPost(g.postId);
      await db.delete(posts).where(eq(posts.id, g.postId));
      revalidatePath('/');
      revalidatePath(`/posts/${g.postId}`);
    }

    await audit({
      action: 'delete-post',
      postId: g.postId,
      actor: g.actor,
      dryRun,
      before: { ...before, commentCount },
      after: null,
    });

    return NextResponse.json({ ok: true, dryRun, deleted: !dryRun, commentCount, before });
  } catch (error) {
    console.error('[agent-admin] delete failed:', error);
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }
}
