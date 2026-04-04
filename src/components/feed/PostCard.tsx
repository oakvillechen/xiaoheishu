'use client';

import { Heart, Share2, MapPin, Images } from 'lucide-react';
import Link from 'next/link';

interface PostCardProps {
  post: {
    id: number;
    title: string;
    content?: string | null;
    imageUrls?: string[];
    link?: string | null;
    city?: string | null;
    tags?: string | null;
    userName?: string;
    userImage?: string | null;
  };
}

export default function PostCard({ post }: PostCardProps) {
  const coverImage = post.imageUrls?.[0];
  const imageCount = post.imageUrls?.length || 0;

  return (
    <div className="group relative bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 dark:border-slate-800">
      <div className="relative aspect-[4/5] overflow-hidden">
        {coverImage ? (
          <img
            src={coverImage}
            alt={post.title}
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-slate-100 flex items-center justify-center p-4 text-slate-400">
            <Share2 className="h-10 w-10 opacity-20" />
          </div>
        )}
        <div className="absolute top-3 left-3 flex gap-2">
          {post.city && (
            <span className="bg-black/40 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {post.city}
            </span>
          )}
        </div>
        {imageCount > 1 && (
          <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1">
            <Images className="h-3 w-3" /> 1/{imageCount}
          </div>
        )}
      </div>

      <div className="p-3">
        <h3 className="font-bold text-sm leading-tight line-clamp-2 group-hover:text-rose-500 transition-colors">
          {post.title}
        </h3>
        
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-slate-200 overflow-hidden">
              {post.userImage ? (
                <img src={post.userImage} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-rose-500 flex items-center justify-center text-[10px] text-white font-bold">
                  {post.userName?.[0] || 'U'}
                </div>
              )}
            </div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {post.userName || '匿名用户'}
            </span>
          </div>

          <div className="flex items-center gap-3 text-slate-400">
             <div className="flex items-center gap-1">
                <Heart className="h-3.5 w-3.5" />
                <span className="text-[10px] font-medium">128</span>
             </div>
          </div>
        </div>
      </div>

      <Link 
        href={`/posts/${post.id}`} 
        className="absolute inset-0 z-10 opacity-0"
        aria-label="查看详情"
      />
    </div>
  );
}
