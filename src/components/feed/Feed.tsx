'use client';

import { useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { reactionKey, type ReactionData } from '@/hooks/useReaction';
import PostCard, { type PostCardProps } from './PostCard';
import { distributeColumns } from './masonry';
import { useColumnCount } from './useColumnCount';

/** 登录用户：批量查询这些卡片里自己点过赞的帖子，写进每张卡片的点赞缓存（一页一个请求） */
function useBatchLikeStatus(posts: PostCardProps['post'][]) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fetched = useRef<{ uid: string | null; ids: Set<number> }>({ uid: null, ids: new Set() });

  useEffect(() => {
    if (!user) return;
    if (fetched.current.uid !== user.uid) fetched.current = { uid: user.uid, ids: new Set() };
    const pending = posts.map((p) => p.id).filter((id) => !fetched.current.ids.has(id));
    if (pending.length === 0) return;
    pending.forEach((id) => fetched.current.ids.add(id));

    void (async () => {
      try {
        for (let i = 0; i < pending.length; i += 50) {
          const chunk = pending.slice(i, i + 50);
          const token = await user.getIdToken();
          const res = await axios.get<{ liked: number[]; available: boolean }>(`/api/me/reactions?postIds=${chunk.join(',')}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const liked = new Set(res.data.liked);
          for (const id of chunk) {
            const post = posts.find((p) => p.id === id);
            const key = reactionKey('like', id, user.uid);
            const old = queryClient.getQueryData<ReactionData>(key);
            queryClient.setQueryData<ReactionData>(key, {
              count: old?.count ?? post?.likeCount ?? 0,
              active: liked.has(id),
              available: res.data.available !== false,
            });
          }
        }
      } catch (error) {
        console.warn('Failed to load like status:', error);
        pending.forEach((id) => fetched.current.ids.delete(id));
      }
    })();
  }, [posts, user, queryClient]);
}

type FeedProps = {
  posts: PostCardProps['post'][];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  emptyText?: string;
};

export default function Feed({
  posts,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  emptyText = '暂无内容，快来分享第一篇吧！',
}: FeedProps) {
  const loaderRef = useRef<HTMLDivElement | null>(null);
  useBatchLikeStatus(posts);
  const columnCount = useColumnCount();
  const columns = useMemo(() => distributeColumns(posts || [], columnCount), [posts, columnCount]);
  const order = useMemo(() => new Map((posts || []).map((p, i) => [p.id, i])), [posts]);

  useEffect(() => {
    if (!hasMore || !onLoadMore) {
      return;
    }

    const loader = loaderRef.current;
    if (!loader) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting && !isLoadingMore) {
          onLoadMore();
        }
      },
      { rootMargin: '400px 0px' },
    );

    observer.observe(loader);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore]);

  if (!posts || posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <p className="text-sm">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1360px] px-2.5 py-3 md:px-4 md:py-4">
      {/* 瀑布流：按列渲染，每列从上往下排；新加载的卡片只会追加到列尾 */}
      <div className="flex items-start gap-2.5 md:gap-4">
        {columns.map((column, columnIndex) => (
          <div key={columnIndex} className="flex min-w-0 flex-1 flex-col gap-2.5 md:gap-4">
            {column.map((post) => (
              <PostCard key={post.id} post={post} priority={(order.get(post.id) ?? 99) < columnCount * 2} />
            ))}
          </div>
        ))}
      </div>

      {hasMore && <div ref={loaderRef} className="h-12" />}

      {isLoadingMore && (
        <div className="py-3 text-center text-xs text-slate-400">正在加载更多...</div>
      )}

      {!hasMore && posts.length > 0 && (
        <div className="py-6 text-center text-xs text-slate-300">— 到底啦 —</div>
      )}
    </div>
  );
}
