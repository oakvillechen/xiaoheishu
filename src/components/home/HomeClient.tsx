'use client';

import Header from '@/components/layout/Header';
import Feed from '@/components/feed/Feed';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUp, Loader2, RefreshCw, Search, X } from 'lucide-react';

import { TAB_CITIES } from '@/lib/constants/cities';
import { CATEGORIES } from '@/lib/constants/categories';
import type { PostCardProps } from '@/components/feed/PostCard';
import { FLASH_MESSAGE_KEY } from '@/components/post/AdminDeletePostButton';
import { categoryPath, cityPath } from '@/lib/site';

/** 普通点击：在首页内切换筛选；Ctrl/⌘/中键：按链接打开城市/分类落地页。链接本身供搜索引擎抓取。 */
function tabClick(event: React.MouseEvent<HTMLAnchorElement>, select: () => void) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  select();
}

type FeedPage = {
  items: PostCardProps['post'][];
  nextCursor: string | null;
};

const PAGE_SIZE = 20;
const SEARCH_MAX_LENGTH = 50;
const ALL = '';

export default function HomeClient() {
  const [activeCategory, setActiveCategory] = useState<string>(ALL);
  const [activeCity, setActiveCity] = useState<string>(ALL);
  const [onlyImagePosts, setOnlyImagePosts] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [flashMessage, setFlashMessage] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // 输入防抖：停止输入 300ms 后才发起搜索
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim().slice(0, SEARCH_MAX_LENGTH));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // 显示从其它页面带过来的一次性提示（例如“帖子已删除”）
  useEffect(() => {
    let message = '';
    try {
      message = window.sessionStorage.getItem(FLASH_MESSAGE_KEY) || '';
      if (message) window.sessionStorage.removeItem(FLASH_MESSAGE_KEY);
    } catch {
      // ignore
    }
    if (!message) return;
    const show = window.setTimeout(() => setFlashMessage(message), 0);
    const hide = window.setTimeout(() => setFlashMessage(''), 3000);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, []);

  const categoryTabs = useMemo(() => [{ en: ALL, cn: '全部' }, ...CATEGORIES], []);
  const cityTabs = useMemo(() => [{ en: ALL, cn: '全部城市', featured: false }, ...TAB_CITIES], []);

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['posts', 'feed', activeCategory, activeCity, onlyImagePosts, searchQuery],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<FeedPage> => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (pageParam) params.set('cursor', pageParam);
      if (activeCategory) params.set('category', activeCategory);
      if (activeCity) params.set('city', activeCity);
      if (onlyImagePosts) params.set('hasImage', '1');
      if (searchQuery) params.set('q', searchQuery);

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
          <form
            role="search"
            className="pt-3"
            onSubmit={(event) => {
              event.preventDefault();
              setSearchQuery(searchInput.trim().slice(0, SEARCH_MAX_LENGTH));
            }}
          >
            <div className="relative mx-auto w-full max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                enterKeyHint="search"
                value={searchInput}
                maxLength={SEARCH_MAX_LENGTH}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="搜索标题、正文、标签，如：租房、Oakville"
                aria-label="搜索帖子"
                className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-9 text-sm outline-none transition-colors focus:border-rose-400 focus:bg-white [&::-webkit-search-cancel-button]:hidden"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setSearchQuery('');
                  }}
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                  aria-label="清除搜索"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </form>
          <div className="overflow-x-auto scrollbar-hide">
            <div suppressHydrationWarning className="flex h-12 items-center gap-6">
              {categoryTabs.map((cat) => (
                <a
                  key={cat.en || 'all'}
                  href={cat.en ? categoryPath(cat.en) : '/'}
                  onClick={(event) => tabClick(event, () => setActiveCategory(cat.en))}
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
                </a>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex h-10 items-center gap-2 pb-1">
              {cityTabs.map((city) => {
                const active = activeCity === city.en;
                return (
                  <a
                    key={city.en || 'all-cities'}
                    href={city.en ? cityPath(city.en) : '/'}
                    onClick={(event) => tabClick(event, () => setActiveCity(city.en))}
                    className={`whitespace-nowrap rounded-full px-3 py-1 text-[12px] transition-colors ${
                      active
                        ? 'bg-rose-500 font-semibold text-white'
                        : city.featured
                          ? 'bg-rose-50 font-medium text-rose-600 hover:bg-rose-100'
                          : 'bg-slate-100 font-medium text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {city.cn}
                  </a>
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
          emptyText={searchQuery ? '没有找到相关帖子' : undefined}
        />
      )}

      {flashMessage && (
        <div
          role="status"
          className="fixed left-1/2 top-20 z-[60] -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2 text-sm text-white shadow-lg"
        >
          {flashMessage}
        </div>
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
