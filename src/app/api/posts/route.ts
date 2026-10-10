import { NextResponse } from 'next/server';
import { db } from '@/db';
import { posts, users } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { AuthTokenError, authErrorResponse, verifyRequestIdentity } from '@/lib/firebase-admin';
import { botMayUseExternalImages, isAllowedImageRef, isHttpsImageUrl } from '@/lib/image-refs';
import { getImageDisplayUrl } from '@/lib/google-drive';
import { revalidatePath } from 'next/cache';
import { normalizeCityName } from '@/lib/constants/cities';
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


export async function GET() {
  try {
    const allPosts = await db
      .select({
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
      })
      .from(posts)
      .leftJoin(users, eq(posts.userId, users.id))
      .orderBy(desc(posts.createdAt));

    const normalized = allPosts.map((post) => {
      const imageIds = parseImageIds(post.images);
      return {
        ...post,
        images: imageIds,
        imageUrls: imageIds.map((value) => getImageDisplayUrl(value)),
      };
    });

    return NextResponse.json(normalized);
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
      category,
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
