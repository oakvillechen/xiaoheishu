import { NextResponse } from 'next/server';
import { db } from '@/db';
import { posts, users, comments } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getImageDisplayUrl } from '@/lib/google-drive';

function parseImageIds(images: string | null): string[] {
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
    return [normalized];
  }
}

export async function GET(
  req: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const params = await paramsPromise;
    const postId = parseInt(params.id);
    
    // Fetch post with user info
    const postData = await db
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
      .where(eq(posts.id, postId))
      .limit(1);

    if (postData.length === 0) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Fetch comments
    const postComments = await db
      .select({
        id: comments.id,
        content: comments.content,
        userName: users.displayName,
        userImage: users.photoURL,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.postId, postId))
      .orderBy(desc(comments.createdAt));

    const imageIds = parseImageIds(postData[0].images);

    return NextResponse.json({
      post: {
        ...postData[0],
        images: imageIds,
        imageUrls: imageIds.map((value) => getImageDisplayUrl(value)),
      },
      comments: postComments,
    });
  } catch (error) {
    console.error('Error fetching post detail:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
