import { NextResponse } from 'next/server';
import { db } from '@/db';
import { posts, comments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getPostDetail } from '@/lib/posts-server';
import { AuthTokenError, authErrorResponse } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/user-access';
import { revalidatePath } from 'next/cache';

export async function GET(
  req: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const params = await paramsPromise;
    const postId = Number.parseInt(params.id, 10);
    if (!Number.isFinite(postId) || postId <= 0) {
      return NextResponse.json({ error: 'Invalid post id' }, { status: 400 });
    }

    const detail = await getPostDetail(postId);
    if (!detail) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error('Error fetching post detail:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);

    const params = await paramsPromise;
    const postId = Number.parseInt(params.id, 10);
    if (!Number.isFinite(postId)) {
      return NextResponse.json({ error: 'Invalid post id' }, { status: 400 });
    }

    await db.delete(comments).where(eq(comments.postId, postId));
    const deleted = await db.delete(posts).where(eq(posts.id, postId)).returning({ id: posts.id });

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    revalidatePath('/');
    revalidatePath(`/posts/${postId}`);
    return NextResponse.json({ ok: true, deletedPostId: deleted[0].id });
  } catch (error) {
    if (error instanceof AuthTokenError) {
      return authErrorResponse(error);
    }

    console.error('Error deleting post:', error);
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }
}
