'use client';

import Link from 'next/link';
import axios from 'axios';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Loader2, Star } from 'lucide-react';
import Header from '@/components/layout/Header';
import Feed from '@/components/feed/Feed';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import type { PostCardProps } from '@/components/feed/PostCard';

type FavoritesPage = { items: PostCardProps['post'][]; nextCursor: string | null; available?: boolean };

export default function FavoritesClient() {
  const { user, loading, login } = useAuth();

  const { data, isLoading, isError, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: ['favorites', user?.uid || 'anon'],
    queryFn: async ({ pageParam }) => {
      const token = await user!.getIdToken();
      const params = new URLSearchParams({ limit: '20' });
      if (pageParam) params.set('cursor', pageParam);
      const res = await axios.get<FavoritesPage>(`/api/me/favorites?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    },
    initialPageParam: '' as string,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    enabled: Boolean(user),
  });

  const posts = data?.pages.flatMap((page) => page.items) ?? [];
  const unavailable = data?.pages[0]?.available === false;

  let body: React.ReactNode;
  if (loading || (user && isLoading)) {
    body = (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
      </div>
    );
  } else if (!user) {
    body = (
      <div className="flex flex-col items-center gap-4 py-20 text-center text-slate-500">
        <p className="text-sm">登录后可以查看你收藏的帖子</p>
        <Button
          onClick={() => {
            login().catch((error: unknown) => alert(error instanceof Error ? error.message : '登录失败，请稍后重试'));
          }}
          className="rounded-full bg-rose-500 hover:bg-rose-600"
        >
          登录 / 注册
        </Button>
      </div>
    );
  } else if (isError) {
    body = <p className="py-20 text-center text-sm text-slate-500">加载失败，请刷新重试</p>;
  } else if (unavailable) {
    body = <p className="py-20 text-center text-sm text-slate-500">收藏功能暂未开放，请稍后再试</p>;
  } else {
    body = (
      <Feed
        posts={posts}
        hasMore={Boolean(hasNextPage)}
        isLoadingMore={isFetchingNextPage}
        onLoadMore={() => void fetchNextPage()}
        emptyText="还没有收藏，看到喜欢的帖子点一下 ☆ 就能收藏"
      />
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-[1360px] px-4 py-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Star className="h-5 w-5 fill-amber-400 text-amber-400" /> 我的收藏
          </h1>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">
            返回首页
          </Link>
        </div>
        {body}
      </main>
    </div>
  );
}
