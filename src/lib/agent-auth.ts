import { timingSafeEqual } from 'node:crypto';

/**
 * Agent API Key 校验与“Key → 固定作者”绑定。
 *
 * 环境变量：
 * - AGENT_PUBLISH_API_KEYS：逗号分隔的 Key 列表（原有）
 * - AGENT_PUBLISH_API_KEY：单个 Key（原有，兼容）
 * - AGENT_PUBLISH_KEY_AUTHORS（新增，可选）：把 Key 绑定到固定发帖用户名。两种格式任选：
 *     JSON：{"<key1>":"DreamHomeGTA","<key2>":"Bot2"}
 *     或  ：<key1>:DreamHomeGTA,<key2>:Bot2
 *   绑定了作者的 Key，请求体里的 username 会被忽略，总是用绑定的作者发帖，防止冒名。
 *   未绑定的 Key 保持旧行为（使用请求体 username），保证现有调用不受影响。
 * - AGENT_PUBLISH_REQUIRE_KEY_AUTHOR=true（可选）：开启后，未绑定作者的 Key 一律拒绝。
 */

function secureEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function splitList(raw: string | undefined): string[] {
  return String(raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function getAgentApiKeys(): string[] {
  const combined = [...splitList(process.env.AGENT_PUBLISH_API_KEYS), ...splitList(process.env.AGENT_PUBLISH_API_KEY)];
  const deduped: string[] = [];
  for (const key of combined) {
    if (!deduped.some((existing) => secureEqual(existing, key))) {
      deduped.push(key);
    }
  }
  return deduped;
}

export function parseKeyAuthorBindings(raw: string | undefined = process.env.AGENT_PUBLISH_KEY_AUTHORS): Array<[string, string]> {
  const text = String(raw || '').trim();
  if (!text) {
    return [];
  }

  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.entries(parsed as Record<string, unknown>)
          .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
          .map(([key, author]) => [key.trim(), author.trim()] as [string, string])
          .filter(([key, author]) => key.length > 0 && author.length > 0);
      }
    } catch {
      console.error('[agent-auth] AGENT_PUBLISH_KEY_AUTHORS is not valid JSON; ignoring it.');
    }
    return [];
  }

  // key:username 格式。Key（base64 / hex）不含冒号，所以按第一个冒号切分。
  return splitList(text)
    .map((pair) => {
      const idx = pair.indexOf(':');
      if (idx <= 0) return null;
      return [pair.slice(0, idx).trim(), pair.slice(idx + 1).trim()] as [string, string];
    })
    .filter((entry): entry is [string, string] => !!entry && entry[0].length > 0 && entry[1].length > 0);
}

export function getProvidedAgentKey(request: Request): string {
  const xApiKey = (request.headers.get('x-api-key') || '').trim();
  if (xApiKey) {
    return xApiKey;
  }
  const auth = (request.headers.get('authorization') || '').trim();
  return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
}

export type AgentAuthResult =
  | { ok: true; apiKey: string; boundAuthor: string | null }
  | { ok: false; status: number; error: string };

export function authenticateAgentRequest(request: Request): AgentAuthResult {
  const keys = getAgentApiKeys();
  if (keys.length === 0) {
    return { ok: false, status: 500, error: 'Server misconfigured: AGENT_PUBLISH_API_KEYS is missing' };
  }

  const provided = getProvidedAgentKey(request);
  if (!provided || !keys.some((key) => secureEqual(key, provided))) {
    return { ok: false, status: 401, error: 'Invalid API key' };
  }

  const binding = parseKeyAuthorBindings().find(([key]) => secureEqual(key, provided));
  const boundAuthor = binding ? binding[1] : null;

  if (!boundAuthor && String(process.env.AGENT_PUBLISH_REQUIRE_KEY_AUTHOR || '').trim().toLowerCase() === 'true') {
    return { ok: false, status: 403, error: 'This API key is not bound to an author (AGENT_PUBLISH_KEY_AUTHORS)' };
  }

  return { ok: true, apiKey: provided, boundAuthor };
}
