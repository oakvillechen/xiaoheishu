import { inArray } from 'drizzle-orm';
import { db } from '@/db';
import { imageMeta } from '@/db/schema';
import { cloudinaryInfoUrl } from '@/lib/image-url';

/**
 * 图片宽高缓存（xhs_image_meta，见 drizzle/0006_profiles_image_meta.sql）。
 * - 表不存在时退回到进程内缓存，不影响页面。
 * - 缺少尺寸的 Cloudinary 图片：每次请求最多查询 MAX_LOOKUPS 张（fl_getinfo，并发、带超时），
 *   查到后写回表里，以后直接读表。非 Cloudinary 图片不查询，前端用默认比例。
 */

export type ImageSize = { width: number; height: number };

const memory = new Map<string, ImageSize>();
const MAX_LOOKUPS = 12;
const LOOKUP_TIMEOUT_MS = 2500;
let warned = false;

function isMissingTable(error: unknown): boolean {
  const text = String((error as { message?: string })?.message || error) + String((error as { cause?: unknown })?.cause || '');
  return /no such table/i.test(text);
}

function warnOnce(error: unknown) {
  if (!isMissingTable(error)) {
    console.error('[image-meta] db error:', error);
  } else if (!warned) {
    warned = true;
    console.warn('[image-meta] xhs_image_meta not found; run drizzle/0006_profiles_image_meta.sql. Using in-memory cache only.');
  }
}

function valid(w: unknown, h: unknown): w is number {
  return typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0 && w < 100000 && h < 100000;
}

/** 上传成功后记录尺寸（失败只打日志） */
export async function recordImageMeta(url: string, width: number, height: number) {
  if (!url || !valid(width, height)) return;
  memory.set(url, { width, height });
  try {
    await db.insert(imageMeta).values({ url, width, height, createdAt: new Date() }).onConflictDoNothing();
  } catch (error) {
    warnOnce(error);
  }
}

async function lookupCloudinary(url: string, signal: AbortSignal): Promise<ImageSize | null> {
  const info = cloudinaryInfoUrl(url);
  if (!info) return null;
  try {
    const res = await fetch(info, { signal, cache: 'force-cache' });
    if (!res.ok) return null;
    const data = (await res.json()) as { input?: { width?: number; height?: number } };
    const w = data.input?.width;
    const h = data.input?.height;
    return valid(w, h) ? { width: w, height: h as number } : null;
  } catch {
    return null;
  }
}

/** 批量取尺寸。返回 Map<url, size>，没有的就不在 Map 里。 */
export async function getImageSizes(urls: string[]): Promise<Map<string, ImageSize>> {
  const result = new Map<string, ImageSize>();
  const unique = Array.from(new Set(urls.filter(Boolean)));
  const needDb = unique.filter((u) => {
    const hit = memory.get(u);
    if (hit) result.set(u, hit);
    return !hit;
  });
  if (needDb.length === 0) return result;

  try {
    const rows = await db.select().from(imageMeta).where(inArray(imageMeta.url, needDb));
    for (const row of rows) {
      const size = { width: row.width, height: row.height };
      memory.set(row.url, size);
      result.set(row.url, size);
    }
  } catch (error) {
    warnOnce(error);
  }

  const missing = needDb.filter((u) => !result.has(u) && cloudinaryInfoUrl(u)).slice(0, MAX_LOOKUPS);
  if (missing.length === 0) return result;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const found = await Promise.all(missing.map(async (u) => [u, await lookupCloudinary(u, controller.signal)] as const));
    for (const [u, size] of found) {
      if (!size) continue;
      result.set(u, size);
      void recordImageMeta(u, size.width, size.height);
    }
  } finally {
    clearTimeout(timer);
  }
  return result;
}
