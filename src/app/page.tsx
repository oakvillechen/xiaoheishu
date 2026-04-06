'use client';

import Header from '@/components/layout/Header';
import Feed from '@/components/feed/Feed';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ArrowUp, Loader2, RefreshCw } from 'lucide-react';

import { CITY_MAP, SUPPORTED_CITIES_CN } from '@/lib/constants/cities';

export default function Home() {
  const [activeCategory, setActiveCategory] = useState('全部');
  const [onlyImagePosts, setOnlyImagePosts] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const catMap: Record<string, string> = {
    '职场就业': 'Job',
    '留学移民': 'Immigration',
    '吃喝玩乐': 'Life',
  };

  const categories = [
    '全部', '职场就业', '留学移民', '吃喝玩乐',
    ...SUPPORTED_CITIES_CN
  ];

  const { data: allPosts, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['posts'],
    queryFn: async () => {
      const res = await fetch('/api/posts');
      if (!res.ok) return [];
      return res.json();
    }
  });

  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 420);
    };

    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const filteredPosts = useMemo(() => {
    const source = Array.isArray(allPosts) ? allPosts : [];

    return source.filter((post: any) => {
      const inCategory = (() => {
        if (activeCategory === '全部') return true;
        if (CITY_MAP[activeCategory]) {
          return post.city === CITY_MAP[activeCategory];
        }
        if (catMap[activeCategory]) {
          return post.category === catMap[activeCategory];
        }
        return false;
      })();

      if (!inCategory) {
        return false;
      }

      if (!onlyImagePosts) {
        return true;
      }

      const hasImage = Array.isArray(post.imageUrls) && post.imageUrls.length > 0;
      const hasContent = typeof post.content === 'string' && post.content.trim().length > 0;
      return hasImage && hasContent;
    });
  }, [activeCategory, allPosts, onlyImagePosts]);

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
        <div className="mx-auto flex h-16 w-full max-w-[1360px] items-center gap-3 px-4">
          <div className="flex-1 overflow-x-auto scrollbar-hide">
            <div suppressHydrationWarning className="flex h-16 items-center gap-6">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`relative whitespace-nowrap text-[14px] transition-colors ${
                    activeCategory === cat
                      ? 'font-bold text-slate-900'
                      : 'font-medium text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {cat}
                  {activeCategory === cat && (
                    <span className="absolute -bottom-2 left-0 h-0.5 w-full rounded-full bg-slate-900" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
        </div>
      ) : (
        <Feed posts={filteredPosts} />
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
