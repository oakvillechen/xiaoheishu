'use client';

import { useEffect, useRef } from 'react';
import PostCard, { type PostCardProps } from './PostCard';

type FeedProps = {
  posts: PostCardProps['post'][];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
};

export default function Feed({ posts, hasMore = false, isLoadingMore = false, onLoadMore }: FeedProps) {
  const loaderRef = useRef<HTMLDivElement | null>(null);

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
        <p className="text-sm">暂无内容，快来分享第一篇吧！</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 py-4">
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 lg:grid-cols-[repeat(4,minmax(0,320px))] lg:justify-center">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
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
