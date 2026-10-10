import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';

/**
 * 基于数据库（Turso / libSQL）的固定窗口限流，适用于 Vercel 等 serverless 多实例环境。
 *
 * 依赖表 `xhs_rate_limits`（见 drizzle/0003_rate_limits.sql）。
 * 如果表还没建（迁移尚未执行），会打印警告并退回到进程内存限流，不会让接口直接报错（fail-open），
 * 这样先合并代码、后执行迁移也不会把网站搞挂。
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

export type RateLimitRule = {
  /** 规则名，例如 'post'、'comment'、'upload' */
  name: string;
  /** 窗口内允许的最大次数 */
  max: number;
  /** 窗口长度（秒） */
  windowSec: number;
};

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();
let warnedMissingTable = false;

function hashIdentifier(identifier: string): string {
  return createHash('sha256').update(identifier).digest('hex').slice(0, 32);
}

function memoryLimit(key: string, rule: RateLimitRule, now: number): RateLimitResult {
  const windowMs = rule.windowSec * 1000;
  const existing = memoryBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: Math.max(rule.max - 1, 0), retryAfterSec: rule.windowSec };
  }
  existing.count += 1;
  const retryAfterSec = Math.max(Math.ceil((existing.resetAt - now) / 1000), 1);
  return {
    allowed: existing.count <= rule.max,
    remaining: Math.max(rule.max - existing.count, 0),
    retryAfterSec,
  };
}

/**
 * 记一次请求并判断是否超限。
 * @param identifier 限流主体，例如用户 uid、API Key、IP。会被哈希后存储，不保存原文。
 */
export async function rateLimit(identifier: string, rule: RateLimitRule): Promise<RateLimitResult> {
  // API_BOT_USER_ID 的请求已经在认证阶段按 RATE_LIMITS.bot 统一限流，这里不再按普通用户规则限制，
  // 避免现有机器人批量发帖被普通用户的“每小时 10 帖”误伤。
  const botUid = String(process.env.API_BOT_USER_ID || '').trim();
  if (botUid && identifier === botUid && rule.name !== 'bot') {
    return { allowed: true, remaining: rule.max, retryAfterSec: rule.windowSec };
  }

  const key = `${rule.name}:${hashIdentifier(identifier)}`;
  const now = Date.now();
  const resetAtIfNew = now + rule.windowSec * 1000;

  try {
    const rows = await db.all<{ count: number; reset_at: number }>(sql`
      INSERT INTO xhs_rate_limits (key, count, reset_at)
      VALUES (${key}, 1, ${resetAtIfNew})
      ON CONFLICT(key) DO UPDATE SET
        count = CASE WHEN xhs_rate_limits.reset_at <= ${now} THEN 1 ELSE xhs_rate_limits.count + 1 END,
        reset_at = CASE WHEN xhs_rate_limits.reset_at <= ${now} THEN ${resetAtIfNew} ELSE xhs_rate_limits.reset_at END
      RETURNING count, reset_at
    `);

    const row = rows[0];
    if (!row) {
      return memoryLimit(key, rule, now);
    }

    const count = Number(row.count);
    const resetAt = Number(row.reset_at);
    return {
      allowed: count <= rule.max,
      remaining: Math.max(rule.max - count, 0),
      retryAfterSec: Math.max(Math.ceil((resetAt - now) / 1000), 1),
    };
  } catch (error) {
    if (!warnedMissingTable) {
      warnedMissingTable = true;
      console.warn(
        '[rate-limit] DB rate limit unavailable (did you apply drizzle/0003_rate_limits.sql?). Falling back to in-memory limiter.',
        error,
      );
    }
    return memoryLimit(key, rule, now);
  }
}

export function rateLimitResponse(result: RateLimitResult) {
  return NextResponse.json(
    { error: '操作太频繁，请稍后再试 (rate limit exceeded)', retryAfterSec: result.retryAfterSec },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfterSec),
        'X-RateLimit-Remaining': String(result.remaining),
      },
    },
  );
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(raw ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** 预设规则。可通过环境变量覆盖，例如 RATE_LIMIT_POST_MAX=5。 */
export const RATE_LIMITS = {
  post: (): RateLimitRule => ({
    name: 'post',
    max: parsePositiveInt(process.env.RATE_LIMIT_POST_MAX, 10),
    windowSec: parsePositiveInt(process.env.RATE_LIMIT_POST_WINDOW_SEC, 3600),
  }),
  comment: (): RateLimitRule => ({
    name: 'comment',
    max: parsePositiveInt(process.env.RATE_LIMIT_COMMENT_MAX, 10),
    windowSec: parsePositiveInt(process.env.RATE_LIMIT_COMMENT_WINDOW_SEC, 60),
  }),
  upload: (): RateLimitRule => ({
    name: 'upload',
    max: parsePositiveInt(process.env.RATE_LIMIT_UPLOAD_MAX, 60),
    windowSec: parsePositiveInt(process.env.RATE_LIMIT_UPLOAD_WINDOW_SEC, 3600),
  }),
  adminMessage: (): RateLimitRule => ({
    name: 'admin-message',
    max: parsePositiveInt(process.env.RATE_LIMIT_ADMIN_MESSAGE_MAX, 60),
    windowSec: parsePositiveInt(process.env.RATE_LIMIT_ADMIN_MESSAGE_WINDOW_SEC, 3600),
  }),
  bot: (): RateLimitRule => ({
    name: 'bot',
    max: parsePositiveInt(process.env.RATE_LIMIT_BOT_MAX, 300),
    windowSec: parsePositiveInt(process.env.RATE_LIMIT_BOT_WINDOW_SEC, 3600),
  }),
  agentPublish: (): RateLimitRule => ({
    name: 'agent-publish',
    // 兼容旧的环境变量名
    max: parsePositiveInt(process.env.AGENT_PUBLISH_RATE_LIMIT_MAX, 30),
    windowSec: parsePositiveInt(process.env.AGENT_PUBLISH_RATE_LIMIT_WINDOW_SEC, 60),
  }),
  agentAdmin: (): RateLimitRule => ({
    name: 'agent-admin',
    max: parsePositiveInt(process.env.AGENT_ADMIN_RATE_LIMIT_MAX, 60),
    windowSec: parsePositiveInt(process.env.AGENT_ADMIN_RATE_LIMIT_WINDOW_SEC, 3600),
  }),
  agentUpload: (): RateLimitRule => ({
    name: 'agent-upload',
    max: parsePositiveInt(process.env.AGENT_UPLOAD_RATE_LIMIT_MAX, 60),
    windowSec: parsePositiveInt(process.env.AGENT_UPLOAD_RATE_LIMIT_WINDOW_SEC, 3600),
  }),
};
