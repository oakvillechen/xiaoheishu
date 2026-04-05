import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { db } from '@/db';
import { posts, users } from '@/db/schema';

export const runtime = 'nodejs';

type PublishRequestBody = {
  title?: unknown;
  content?: unknown;
  username?: unknown;
  link?: unknown;
  images?: unknown;
  city?: unknown;
  tags?: unknown;
  category?: unknown;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

function normalizeString(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function secureEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

function parseApiKeysFromEnv(): string[] {
  const multiRaw = normalizeString(process.env.AGENT_PUBLISH_API_KEYS);
  const singleRaw = normalizeString(process.env.AGENT_PUBLISH_API_KEY);

  const parsedMulti = multiRaw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  const combined = [...parsedMulti, ...(singleRaw ? [singleRaw] : [])];
  const deduped: string[] = [];
  for (const key of combined) {
    if (!deduped.some((existing) => secureEqual(existing, key))) {
      deduped.push(key);
    }
  }

  return deduped;
}

function getProvidedApiKey(request: Request): string {
  const xApiKey = normalizeString(request.headers.get('x-api-key'));
  if (xApiKey) {
    return xApiKey;
  }

  const authHeader = normalizeString(request.headers.get('authorization'));
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  return '';
}

function isApiKeyValid(provided: string, expectedKeys: string[]): boolean {
  if (!provided || expectedKeys.length === 0) {
    return false;
  }

  return expectedKeys.some((expected) => secureEqual(provided, expected));
}

function buildAgentUserId(username: string): string {
  const digest = createHash('sha256').update(username).digest('hex').slice(0, 24);
  return `agent_${digest}`;
}

function parsePositiveIntEnv(name: string, fallback: number): number {
  const raw = normalizeString(process.env[name]);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function getClientIp(request: Request): string {
  const xff = normalizeString(request.headers.get('x-forwarded-for'));
  if (!xff) {
    return 'unknown';
  }

  return xff.split(',')[0]?.trim() || 'unknown';
}

function buildRateLimitKey(request: Request, apiKey: string): string {
  const ip = getClientIp(request);
  const keyDigest = createHash('sha256').update(apiKey).digest('hex').slice(0, 16);
  return `${ip}:${keyDigest}`;
}

function checkRateLimit(request: Request, apiKey: string): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const maxRequests = parsePositiveIntEnv('AGENT_PUBLISH_RATE_LIMIT_MAX', 30);
  const windowSec = parsePositiveIntEnv('AGENT_PUBLISH_RATE_LIMIT_WINDOW_SEC', 60);
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const bucketKey = buildRateLimitKey(request, apiKey);

  const existing = rateLimitBuckets.get(bucketKey);
  if (!existing || existing.resetAt <= now) {
    rateLimitBuckets.set(bucketKey, {
      count: 1,
      resetAt: now + windowMs,
    });

    return {
      allowed: true,
      remaining: Math.max(maxRequests - 1, 0),
      retryAfterSec: windowSec,
    };
  }

  if (existing.count >= maxRequests) {
    const retryAfterSec = Math.max(Math.ceil((existing.resetAt - now) / 1000), 1);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec,
    };
  }

  existing.count += 1;
  rateLimitBuckets.set(bucketKey, existing);

  return {
    allowed: true,
    remaining: Math.max(maxRequests - existing.count, 0),
    retryAfterSec: Math.max(Math.ceil((existing.resetAt - now) / 1000), 1),
  };
}

function parseImageRefs(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const accepted: string[] = [];

  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }

    const normalized = item.trim();
    if (!normalized) {
      continue;
    }

    const isLocalPath = normalized.startsWith('/');
    const isExternalUrl = /^https?:\/\//i.test(normalized);
    const isDriveLikeId = /^[a-zA-Z0-9_-]{10,}$/.test(normalized);

    if (isLocalPath || isExternalUrl || isDriveLikeId) {
      accepted.push(normalized);
    }

    if (accepted.length >= 9) {
      break;
    }
  }

  return accepted;
}

export async function POST(request: Request) {
  const expectedKeys = parseApiKeysFromEnv();
  if (expectedKeys.length === 0) {
    return NextResponse.json({ error: 'Server misconfigured: AGENT_PUBLISH_API_KEYS is missing' }, { status: 500 });
  }

  const providedApiKey = getProvidedApiKey(request);
  if (!isApiKeyValid(providedApiKey, expectedKeys)) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  const rateLimit = checkRateLimit(request, providedApiKey);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfterSec: rateLimit.retryAfterSec },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSec),
          'X-RateLimit-Remaining': String(rateLimit.remaining),
        },
      },
    );
  }

  try {
    const body = (await request.json()) as PublishRequestBody;

    const title = normalizeString(body.title);
    const content = normalizeString(body.content);
    const username = normalizeString(body.username);
    const link = normalizeString(body.link) || null;
    const city = normalizeString(body.city) || null;
    const tags = normalizeString(body.tags) || null;
    const category = normalizeString(body.category) || null;
    const imageIds = parseImageRefs(body.images);

    if (!title || !content || !username) {
      return NextResponse.json({ error: 'Missing required fields: title, content, username' }, { status: 400 });
    }

    if (username.length > 40) {
      return NextResponse.json({ error: 'username must be 40 characters or fewer' }, { status: 400 });
    }

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
        title,
        content,
        link,
        images: imageIds.length > 0 ? JSON.stringify(imageIds) : null,
        userId,
        city,
        tags,
        category,
      })
      .returning();

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