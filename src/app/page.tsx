'use client';

import Header from '@/components/layout/Header';
import Feed from '@/components/feed/Feed';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUp, Loader2, RefreshCw } from 'lucide-react';

import { CITIES } from '@/lib/constants/cities';
import { CATEGORIES } from '@/lib/constants/categories';
import type { PostCardProps } from '@/components/feed/PostCard';

type FeedPage = {
  items: PostCardProps['post'][];
  nextCursor: string | null;
};

const PAGE_SIZE = 20;
const ALL = '';

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<string>(ALL);
  const [activeCity, setActiveCity] = useState<string>(ALL);
  const [onlyImagePosts, setOnlyImagePosts] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const categoryTabs = useMemo(() => [{ en: ALL, cn: '全部' }, ...CATEGORIES], []);
  const cityTabs = useMemo(() => [{ en: ALL, cn: '全部城市', featured: false }, ...CITIES], []);

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['posts', 'feed', activeCategory, activeCity, onlyImagePosts],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<FeedPage> => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (pageParam) params.set('cursor', pageParam);
      if (activeCategory) params.set('category', activeCategory);
      if (activeCity) params.set('city', activeCity);
      if (onlyImagePosts) params.set('hasImage', '1');

      const res = await fetch(`/api/posts?${params.toString()}`);
      if (!res.ok) {
        return { items: [], nextCursor: null };
      }
      return res.json();
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const feedPosts = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 420);
    };

    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleRefresh = async () => {
    await refetch();
  };

  const handleBackToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="min-h-screen bg-[#f6f7fb]">
      <Header />

      <section className="sticky top-16 z-40 border-b border-slate-200 bg-white/96 backdrop-blur-md">
        <div className="mx-auto w-full max-w-[1360px] px-4">
          <div className="overflow-x-auto scrollbar-hide">
            <div suppressHydrationWarning className="flex h-12 items-center gap-6">
              {categoryTabs.map((cat) => (
                <button
                  key={cat.en || 'all'}
                  onClick={() => setActiveCategory(cat.en)}
                  className={`relative whitespace-nowrap text-[14px] transition-colors ${
                    activeCategory === cat.en
                      ? 'font-bold text-slate-900'
                      : 'font-medium text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {cat.cn}
                  {activeCategory === cat.en && (
                    <span className="absolute -bottom-2 left-0 h-0.5 w-full rounded-full bg-slate-900" />
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex h-10 items-center gap-2 pb-1">
              {cityTabs.map((city) => {
                const active = activeCity === city.en;
                return (
                  <button
                    key={city.en || 'all-cities'}
                    onClick={() => setActiveCity(city.en)}
                    className={`whitespace-nowrap rounded-full px-3 py-1 text-[12px] transition-colors ${
                      active
                        ? 'bg-rose-500 font-semibold text-white'
                        : city.featured
                          ? 'bg-rose-50 font-medium text-rose-600 hover:bg-rose-100'
                          : 'bg-slate-100 font-medium text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {city.cn}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
        </div>
      ) : (
        <Feed
          posts={feedPosts}
          hasMore={!!hasNextPage}
          isLoadingMore={isFetchingNextPage}
          onLoadMore={handleLoadMore}
        />
      )}

      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-slate-900 px-4 text-xs font-semibold text-white shadow-lg transition-transform hover:scale-105"
          aria-label="刷新帖子"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          刷新
        </button>

        {showBackToTop ? (
          <button
            type="button"
            onClick={handleBackToTop}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-rose-500 px-4 text-xs font-semibold text-white shadow-lg transition-transform hover:scale-105"
            aria-label="返回顶部"
          >
            <ArrowUp className="h-4 w-4" />
            返回顶部 🔝
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setOnlyImagePosts((prev) => !prev)}
            className={`inline-flex h-11 items-center justify-center rounded-full px-4 text-xs font-semibold shadow-lg transition-transform hover:scale-105 ${
              onlyImagePosts
                ? 'bg-rose-500 text-white'
                : 'bg-white text-slate-700'
            }`}
            aria-label="只看图文"
          >
            只看图文
          </button>
        )}
      </div>
    </main>
  );
}
