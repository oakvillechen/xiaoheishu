import { NextResponse } from 'next/server';
import { withLikeCounts } from '@/lib/posts-server';
import { db } from '@/db';
import { posts, users } from '@/db/schema';
import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { AuthTokenError, authErrorResponse, verifyRequestIdentity } from '@/lib/firebase-admin';
import { botMayUseExternalImages, isAllowedImageRef, isHttpsImageUrl } from '@/lib/image-refs';
import { getImageDisplayUrl } from '@/lib/google-drive';
import { revalidatePath } from 'next/cache';
import { cityMatchValues, normalizeCityName } from '@/lib/constants/cities';
import { categoryMatchValues, normalizeCategory } from '@/lib/constants/categories';
import { createPostSchema, parseJsonBody } from '@/lib/validation';
import { RATE_LIMITS, rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PostImageIds = string[];

function parseImageIds(images: string | null): PostImageIds {
  if (!images) {
    return [];
  }

  const normalized = images.trim();
  if (!normalized) {
    return [];
  }

  try {
    const parsed = JSON.parse(normalized) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
    }

    if (typeof parsed === 'string' && parsed.length > 0) {
      return [parsed];
    }

    return [];
  } catch {
    // Backward compatibility for rows that stored a plain URL or single id string.
    return [normalized];
  }
}


const DEFAULT_PAGE_SIZE = 20;
const MAX_QUERY_LENGTH = 50;

/** 转义 LIKE 通配符（配合 ESCAPE '\\' 使用） */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
const MAX_PAGE_SIZE = 50;

type Cursor = { createdAt: number; id: number };

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(`${cursor.createdAt}:${cursor.id}`).toString('base64url');
}

function decodeCursor(raw: string | null): Cursor | null {
  if (!raw) return null;
  try {
    const [createdAt, id] = Buffer.from(raw, 'base64url').toString('utf8').split(':').map((v) => Number.parseInt(v, 10));
    if (Number.isFinite(createdAt) && Number.isFinite(id)) {
      return { createdAt, id };
    }
  } catch {
    // ignore
  }
  return null;
}

const postSelection = {
  id: posts.id,
  title: posts.title,
  content: posts.content,
  link: posts.link,
  images: posts.images,
  city: posts.city,
  tags: posts.tags,
  category: posts.category,
  userName: users.displayName,
  userImage: users.photoURL,
  createdAt: posts.createdAt,
};

type PostRow = {
  images: string | null;
  createdAt: Date | null;
  id: number;
};

function toResponsePost<T extends PostRow>(post: T) {
  const imageIds = parseImageIds(post.images);
  return {
    ...post,
    images: imageIds,
    imageUrls: imageIds.map((value) => getImageDisplayUrl(value)),
  };
}

// 排序键：created_at 为秒级时间戳，空值按 0 处理；同一秒内按 id 倒序
const createdAtKey = sql`coalesce(${posts.createdAt}, 0)`;

/**
 * GET /api/posts
 *
 * - 不带任何查询参数：返回全部帖子的数组（旧行为，供后台等旧调用方使用）。
 * - 带 limit / cursor / city / category / hasImage / q 任一参数：分页模式，返回 { items, nextCursor }。
 *   - limit：默认 20，最大 50
 *   - cursor：上一页返回的 nextCursor
 *   - city：城市（中英文均可，如 Oakville / 奥克维尔），会同时匹配旧数据里的中文/英文写法
 *   - category：分类（中英文均可，如 Life / 生活）
 *   - hasImage=1：只要有图片的帖子
 *   - q：搜索词（≤ 50 字），在标题、正文、标签里做不区分大小写的模糊匹配，可与其它筛选组合
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const params = url.searchParams;
    const paginated = ['limit', 'cursor', 'city', 'category', 'hasImage', 'q'].some((key) => params.has(key));

    if (!paginated) {
      const allPosts = await db
        .select(postSelection)
        .from(posts)
        .leftJoin(users, eq(posts.userId, users.id))
        .orderBy(desc(posts.createdAt));

      return NextResponse.json(await withLikeCounts(allPosts.map(toResponsePost)));
    }

    const limitParam = Number.parseInt(params.get('limit') || '', 10);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;

    const conditions: SQL[] = [];

    const cityParam = params.get('city');
    const city = normalizeCityName(cityParam);
    if (city) {
      conditions.push(inArray(sql`lower(trim(${posts.city}))`, cityMatchValues(city)));
    }

    const categoryParam = params.get('category');
    const category = normalizeCategory(categoryParam);
    if (category) {
      conditions.push(inArray(sql`lower(trim(${posts.category}))`, categoryMatchValues(category)));
    }

    const q = (params.get('q') || '').trim().replace(/\s+/g, ' ');
    if (q.length > MAX_QUERY_LENGTH) {
      return NextResponse.json({ error: `搜索词不能超过 ${MAX_QUERY_LENGTH} 个字` }, { status: 400 });
    }
    if (q) {
      const pattern = `%${escapeLike(q.toLowerCase())}%`;
      conditions.push(
        sql`(lower(${posts.title}) like ${pattern} escape '\\' or lower(coalesce(${posts.content}, '')) like ${pattern} escape '\\' or lower(coalesce(${posts.tags}, '')) like ${pattern} escape '\\')`,
      );
    }

    if (params.get('hasImage') === '1') {
      conditions.push(sql`${posts.images} is not null and trim(${posts.images}) not in ('', '[]')`);
    }

    const cursorParam = params.get('cursor');
    const cursor = decodeCursor(cursorParam);
    if (cursorParam && !cursor) {
      return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 });
    }
    if (cursor) {
      conditions.push(
        sql`(${createdAtKey} < ${cursor.createdAt} or (${createdAtKey} = ${cursor.createdAt} and ${posts.id} < ${cursor.id}))`,
      );
    }

    const rows = await db
      .select(postSelection)
      .from(posts)
      .leftJoin(users, eq(posts.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(createdAtKey), desc(posts.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const last = pageRows[pageRows.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({
            createdAt: last.createdAt ? Math.floor(last.createdAt.getTime() / 1000) : 0,
            id: last.id,
          })
        : null;

    return NextResponse.json({ items: await withLikeCounts(pageRows.map(toResponsePost)), nextCursor });
  } catch (error) {
    console.error('Error fetching posts:', error);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { uid, viaBotSecret } = await verifyRequestIdentity(req);

    const parsed = await parseJsonBody(req, createPostSchema);
    if (!parsed.ok) {
      return parsed.response;
    }
    const { title, content, link, images, userId, city, tags, category } = parsed.data;

    if (uid !== userId) {
      return NextResponse.json({ error: 'Forbidden userId' }, { status: 403 });
    }

    const allowExternal = viaBotSecret && botMayUseExternalImages();
    const badImage = images.find((ref) => !(isAllowedImageRef(ref) || (allowExternal && isHttpsImageUrl(ref))));
    if (badImage) {
      return NextResponse.json(
        { error: '图片地址不合法：只接受本站上传的图片（Cloudinary）或站内路径', field: 'images' },
        { status: 400 },
      );
    }

    const limit = await rateLimit(uid, RATE_LIMITS.post());
    if (!limit.allowed) {
      return rateLimitResponse(limit);
    }

    const newPost = await db.insert(posts).values({
      title,
      content,
      link,
      images: JSON.stringify(images),
      userId,
      city: normalizeCityName(city),
      tags,
      category: normalizeCategory(category),
    }).returning();

    revalidatePath('/');
    return NextResponse.json(newPost);
  } catch (error) {
    if (error instanceof AuthTokenError) {
      return authErrorResponse(error);
    }

    console.error('Error creating post:', error);
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
}
