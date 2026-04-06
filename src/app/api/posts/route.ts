import { NextResponse } from 'next/server';
import { db } from '@/db';
import { posts, users } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { AuthTokenError, verifyFirebaseTokenFromRequest } from '@/lib/firebase-admin';
import { getImageDisplayUrl } from '@/lib/google-drive';

export const runtime = 'nodejs';

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

import { normalizeCityName } from '@/lib/constants/cities';

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
    const uid = await verifyFirebaseTokenFromRequest(req);
    const body = await req.json();
    const { title, content, link, images, userId, city, tags, category } = body;

    if (!title || !content || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (uid !== userId) {
      return NextResponse.json({ error: 'Forbidden userId' }, { status: 403 });
    }

    if (!Array.isArray(images) || images.length === 0 || images.length > 9) {
      return NextResponse.json({ error: 'Images must be an array with 1-9 items' }, { status: 400 });
    }

    const imageIds = images.filter((value: unknown): value is string => typeof value === 'string' && value.length > 0);
    if (imageIds.length !== images.length) {
      return NextResponse.json({ error: 'Invalid image ids' }, { status: 400 });
    }

    const normalizedCity = normalizeCityName(city);

    const newPost = await db.insert(posts).values({
      title,
      content,
      link: link || null,
      images: JSON.stringify(imageIds),
      userId,
      city: normalizedCity,
      tags: tags || null,
      category: category || null,
    }).returning();

    return NextResponse.json(newPost);
  } catch (error) {
    if (error instanceof AuthTokenError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    console.error('Error creating post:', error);
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
}
