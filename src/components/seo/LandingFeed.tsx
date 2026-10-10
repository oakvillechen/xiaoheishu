'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import axios from 'axios';
import Feed from '@/components/feed/Feed';
import type { PostCardProps } from '@/components/feed/PostCard';

type FeedPage = { items: PostCardProps['post'][]; nextCursor: string | null };

/** 落地页的帖子流：第一页由服务端渲染（可被搜索引擎抓取），之后在浏览器里无限滚动加载 */
export default function LandingFeed({
  filter,
  initialPage,
  emptyText,
}: {
  filter: { city?: string; category?: string };
  initialPage: FeedPage;
  emptyText: string;
}) {
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: ['posts', 'landing', filter.city || '', filter.category || ''],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '20' });
      if (filter.city) params.set('city', filter.city);
      if (filter.category) params.set('category', filter.category);
      if (pageParam) params.set('cursor', pageParam);
      const res = await axios.get<FeedPage>(`/api/posts?${params.toString()}`);
      return res.data;
    },
    initialPageParam: '' as string,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    initialData: { pages: [initialPage], pageParams: [''] },
    staleTime: 60_000,
  });

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
