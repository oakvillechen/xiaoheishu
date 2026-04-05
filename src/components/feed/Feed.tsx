'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import PostCard from './PostCard';

const INITIAL_BATCH_SIZE = 20;
const LOAD_MORE_BATCH_SIZE = 12;

export default function Feed({ posts }: { posts: any[] }) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loaderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount(INITIAL_BATCH_SIZE);
  }, [posts]);

  const visiblePosts = useMemo(() => posts.slice(0, visibleCount), [posts, visibleCount]);
  const hasMore = visibleCount < posts.length;

  useEffect(() => {
    if (!hasMore) {
      return;
    }

    const loader = loaderRef.current;
    if (!loader) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting || isLoadingMore) {
          return;
        }

        setIsLoadingMore(true);
        setVisibleCount((prev) => Math.min(prev + LOAD_MORE_BATCH_SIZE, posts.length));
      },
      {
        rootMargin: '180px 0px',
      },
    );

    observer.observe(loader);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoadingMore, posts.length]);

  useEffect(() => {
    if (isLoadingMore) {
      setIsLoadingMore(false);
    }
  }, [visibleCount, isLoadingMore]);

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
        {visiblePosts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      {hasMore && <div ref={loaderRef} className="h-12" />}

      {isLoadingMore && (
        <div className="py-3 text-center text-xs text-slate-400">正在加载更多...</div>
      )}
    </div>
  );
}
