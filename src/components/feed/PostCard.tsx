'use client';

import { useState } from 'react';
import { Heart, Share2, MapPin, Images, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
  const images = post.imageUrls || [];
  const imageCount = images.length;
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isOpening, setIsOpening] = useState(false);

  const coverImage = imageCount > 0 ? images[activeImageIndex] : undefined;

  const handleOpenDetail = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (isOpening) {
      return;
    }

    setIsOpening(true);
    window.setTimeout(() => {
      router.push(`/posts/${post.id}`);
    }, 350);
  };

  const showPreviousImage = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveImageIndex((prev) => (prev - 1 + imageCount) % imageCount);
  };

  const showNextImage = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveImageIndex((prev) => (prev + 1) % imageCount);
  };

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-transform ${isOpening ? 'z-30 scale-[1.06] -translate-y-2' : 'hover:-translate-y-0.5'}`}
      style={{ transitionDuration: '350ms' }}
    >
      <div className="relative aspect-square overflow-hidden">
        {coverImage ? (
          <img
            src={coverImage}
            alt={post.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-100 p-4 text-slate-400">
            <Share2 className="h-10 w-10 opacity-20" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-2">
          {post.city && (
            <span className="bg-black/40 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {post.city}
            </span>
          )}
        </div>
        {imageCount > 1 && (
          <>
            <div className="absolute top-3 right-3 z-20 bg-black/50 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1">
              <Images className="h-3 w-3" /> {activeImageIndex + 1}/{imageCount}
            </div>

            <button
              type="button"
              onClick={showPreviousImage}
              className="absolute left-2 top-1/2 z-20 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
              aria-label="上一张图片"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={showNextImage}
              className="absolute right-2 top-1/2 z-20 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
              aria-label="下一张图片"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      <div className="h-20 px-3 pt-2">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-[1.4] text-slate-900 transition-colors group-hover:text-rose-500 md:text-[14px]">
          {post.title}
        </h3>

        <div className="mt-2 flex h-8 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="h-6 w-6 overflow-hidden rounded-full bg-slate-200">
              {post.userImage ? (
                <img src={post.userImage} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-rose-500 flex items-center justify-center text-[10px] text-white font-bold">
                  {post.userName?.[0] || 'U'}
                </div>
              )}
            </div>
            <span className="truncate text-[12px] font-medium text-slate-500">
              {post.userName || '匿名用户'}
            </span>
          </div>

          <div className="flex items-center gap-1 text-slate-400">
            <Heart className="h-4 w-4" />
            <span className="text-[11px] font-medium">128</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleOpenDetail}
        className="absolute inset-0 z-10"
        aria-label="查看详情"
      />
    </article>
  );
}
