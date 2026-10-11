'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import Feed from '@/components/feed/Feed';
import type { PostCardProps } from '@/components/feed/PostCard';
import { useAuth } from '@/context/AuthContext';

export type FeedPage = { items: PostCardProps['post'][]; nextCursor: string | null; available?: boolean };

/**
 * 通用无限滚动瀑布流：url 返回 { items, nextCursor }（/api/posts、/api/users/:id/posts、/api/me/favorites）。
 * initialPage 由服务端渲染时传入（可被搜索引擎抓取）；auth=true 时请求带登录 token。
 */
export default function InfiniteFeed({
  queryKey,
  url,
  initialPage,
  auth = false,
  emptyText,
  unavailableText = '功能暂未开放，请稍后再试',
}: {
  queryKey: readonly unknown[];
  url: string;
  initialPage?: FeedPage;
  auth?: boolean;
  emptyText: string;
  unavailableText?: string;
}) {
  const { user } = useAuth();
  const { data, isLoading, isError, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: [...queryKey, auth ? user?.uid || 'anon' : 'public'],
    queryFn: async ({ pageParam }) => {
      const sep = url.includes('?') ? '&' : '?';
      const full = `${url}${sep}limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`;
      const headers = auth && user ? { Authorization: `Bearer ${await user.getIdToken()}` } : undefined;
      return (await axios.get<FeedPage>(full, { headers })).data;
    },
    initialPageParam: '' as string,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    ...(initialPage ? { initialData: { pages: [initialPage], pageParams: [''] }, staleTime: 60_000 } : {}),
    enabled: !auth || Boolean(user),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-7 w-7 animate-spin text-rose-500" />
      </div>
    );
  }
  if (isError) return <p className="py-16 text-center text-sm text-slate-500">加载失败，请刷新重试</p>;
  if (data?.pages[0]?.available === false) return <p className="py-16 text-center text-sm text-slate-500">{unavailableText}</p>;

  const posts = data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <Feed
      posts={posts}
      hasMore={Boolean(hasNextPage)}
      isLoadingMore={isFetchingNextPage}
      onLoadMore={() => void fetchNextPage()}
      emptyText={emptyText}
    />
  );
}
