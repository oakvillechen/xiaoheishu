import { createHash, timingSafeEqual } from 'node:crypto';
import { getProvidedAgentKey } from '@/lib/agent-auth';

/**
 * 维护接口（/api/agent/admin/*）的鉴权。
 *
 * - 使用独立环境变量 AGENT_ADMIN_API_KEY（可逗号分隔多个），与发帖用的 AGENT_PUBLISH_API_KEYS 完全分开。
 * - 未配置 AGENT_ADMIN_API_KEY 时，接口视为不存在，返回 404。
 * - 发帖 Key、API_BOT_SECRET、Firebase Token 都不能调用维护接口。
 */

function secureEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function adminKeys(): string[] {
  return String(process.env.AGENT_ADMIN_API_KEY || '')
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

export type AgentAdminAuth =
  | { ok: true; apiKey: string; actor: string }
  | { ok: false; status: 401 | 404; error: string };

export function authenticateAgentAdmin(request: Request): AgentAdminAuth {
  const keys = adminKeys();
  if (keys.length === 0) {
    return { ok: false, status: 404, error: 'Not Found' };
  }

  const provided = getProvidedAgentKey(request);
  if (!provided || !keys.some((key) => secureEqual(key, provided))) {
    return { ok: false, status: 401, error: 'Invalid admin API key' };
  }

  const digest = createHash('sha256').update(provided).digest('hex').slice(0, 12);
  return { ok: true, apiKey: provided, actor: `agent-admin:${digest}` };
}
