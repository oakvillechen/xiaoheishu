'use client';

import Header from '@/components/layout/Header';
import Feed from '@/components/feed/Feed';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Loader2, Compass, Layers, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Home() {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState('全部');

  const cityMap: Record<string, string> = {
    '多伦多': 'Toronto',
    '温哥华': 'Vancouver',
    '蒙特利尔': 'Montreal',
    '卡尔加里': 'Calgary',
    '渥太华': 'Ottawa',
    '埃德蒙顿': 'Edmonton',
    '密西沙加': 'Mississauga',
    '温尼伯': 'Winnipeg',
    '哈利法克斯': 'Halifax',
    '爱德华王子岛': 'PEI',
    '奥克维尔': 'Oakville',
  };

  const catMap: Record<string, string> = {
    '职场就业': 'Job',
    '留学移民': 'Immigration',
    '吃喝玩乐': 'Life',
  };

  const categories = [
    '全部', '职场就业', '留学移民', '吃喝玩乐', 
    '多伦多', '温哥华', '蒙特利尔', '卡尔加里', 
    '渥太华', '埃德蒙顿', '密西沙加', '温尼伯', 
    '哈利法克斯', '爱德华王子岛', '奥克维尔'
  ];

  const { data: allPosts, isLoading } = useQuery({
    queryKey: ['posts'],
    queryFn: async () => {
      const res = await fetch('/api/posts');
      if (!res.ok) return [];
      return res.json();
    }
  });

  const filteredPosts = allPosts?.filter((post: any) => {
    if (activeCategory === '全部') return true;
    
    // Check if it's a city filter
    if (cityMap[activeCategory]) {
      return post.city === cityMap[activeCategory];
    }

    if (catMap[activeCategory]) {
      return post.category === catMap[activeCategory];
    }
    return false;
  });

  return (
    <main className="min-h-screen">
      <Header />
      
      {/* 侧边栏/分类栏 */}
      <div className="bg-white/50 backdrop-blur-sm border-b overflow-x-auto scrollbar-hide">
        <div suppressHydrationWarning className="container mx-auto px-4 flex items-center gap-x-6 gap-y-2 h-14">
          {categories.map((cat) => (
            <button 
              key={cat} 
              onClick={() => setActiveCategory(cat)}
              className={`text-sm font-medium whitespace-nowrap transition-all duration-200 relative py-1 ${
                activeCategory === cat ? 'text-rose-500' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {cat}
              {activeCategory === cat && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-rose-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
        </div>
      ) : (
        <>
          {/* Welcome Section for non-logged in users */}
          {!user && (
             <div className="container mx-auto px-4 mt-8">
               <div className="bg-gradient-to-br from-rose-500 to-orange-400 rounded-3xl p-8 text-white relative overflow-hidden">
                 <div className="relative z-10">
                   <h1 className="text-3xl font-black mb-3">分享你在加拿大的精彩生活</h1>
                   <p className="opacity-90 max-w-lg mb-6">加入最懂加拿大生活的华人社区，在这里发现关于移民、留学、就业的一切实用信息。</p>
                   <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                         <Compass className="h-5 w-5" />
                         <span className="text-sm font-medium text-white/80">真实体验</span>
                      </div>
                      <div className="flex items-center gap-2">
                         <Layers className="h-5 w-5" />
                         <span className="text-sm font-medium text-white/80">社区共建</span>
                      </div>
                   </div>
                 </div>
                 <div className="absolute top-0 right-0 h-full w-1/3 opacity-20 pointer-events-none transform translate-x-1/4">
                    <Zap className="h-full w-full" />
                 </div>
               </div>
             </div>
          )}

          <Feed posts={filteredPosts || []} />
        </>
      )}
    </main>
  );
}
