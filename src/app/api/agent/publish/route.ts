import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { posts, users } from '@/db/schema';
import { authenticateAgentRequest } from '@/lib/agent-auth';
import { normalizeCityName } from '@/lib/constants/cities';
import { normalizeCategory } from '@/lib/constants/categories';
import { RATE_LIMITS, rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { agentPublishSchema, parseJsonBody } from '@/lib/validation';

export const runtime = 'nodejs';

function buildAgentUserId(username: string): string {
  const digest = createHash('sha256').update(username).digest('hex').slice(0, 24);
  return `agent_${digest}`;
}

/**
 * POST /api/agent/publish
 * 鉴权：x-api-key 或 Authorization: Bearer <key>
 * 如果 Key 在 AGENT_PUBLISH_KEY_AUTHORS 中绑定了作者，则忽略 body.username，始终使用绑定作者。
 */
export async function POST(request: Request) {
  const auth = authenticateAgentRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const limit = await rateLimit(`agent:${auth.apiKey}`, RATE_LIMITS.agentPublish());
  if (!limit.allowed) {
    return rateLimitResponse(limit);
  }

  try {
    const parsed = await parseJsonBody(request, agentPublishSchema);
    if (!parsed.ok) {
      return parsed.response;
    }
    const body = parsed.data;

    const username = (auth.boundAuthor || body.username || '').trim();
    if (!username) {
      return NextResponse.json({ error: 'Missing required fields: title, content, username' }, { status: 400 });
    }
    if (username.length > 40) {
      return NextResponse.json({ error: 'username must be 40 characters or fewer' }, { status: 400 });
    }

    const imageIds = body.images ?? [];
    const userId = buildAgentUserId(username);
    const email = `${userId}@agent.local`;

    await db
      .insert(users)
      .values({
        id: userId,
        email,
        displayName: username,
        photoURL: null,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          displayName: username,
          email,
        },
      });

    const [inserted] = await db
      .insert(posts)
      .values({
        title: body.title,
        content: body.content,
        link: body.link,
        images: imageIds.length > 0 ? JSON.stringify(imageIds) : null,
        userId,
        city: normalizeCityName(body.city),
        tags: body.tags,
        category: normalizeCategory(body.category),
      })
      .returning();

    revalidatePath('/');
    revalidatePath(`/u/${encodeURIComponent(userId)}`);

    return NextResponse.json({
      ok: true,
      post: {
        ...inserted,
        username,
        images: imageIds,
      },
    });
  } catch (error) {
    console.error('Agent publish failed:', error);
    return NextResponse.json({ error: 'Failed to publish post' }, { status: 500 });
  }
}
