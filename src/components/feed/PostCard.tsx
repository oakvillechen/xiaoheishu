'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MapPin, Images } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { displayCityName } from '@/lib/constants/cities';
import { cloudinarySrcSet, cloudinaryThumb } from '@/lib/image-url';
import ReactionButton from '@/components/post/ReactionButton';
import { TEXT_ONLY_RATIO, coverRatio } from './masonry';

export interface PostCardProps {
  post: {
    id: number;
    title: string;
    content?: string | null;
    imageUrls?: string[];
    link?: string | null;
    city?: string | null;
    tags?: string | null;
    userId?: string | null;
    userName?: string | null;
    userImage?: string | null;
    likeCount?: number;
    coverWidth?: number | null;
    coverHeight?: number | null;
  };
  /** 首屏的几张卡片立即加载图片，其余懒加载 */
  priority?: boolean;
}

// 卡片宽度：手机约半屏，桌面 3–5 列
const CARD_SIZES = '(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw';

export function userPath(userId: string) {
  return `/u/${encodeURIComponent(userId)}`;
}

export default function PostCard({ post, priority = false }: PostCardProps) {
  const router = useRouter();
  const images = post.imageUrls || [];
  const cover = images[0];
  const [isOpening, setIsOpening] = useState(false);
  const [failed, setFailed] = useState(false);

  const ratio = cover && !failed ? coverRatio(post.coverWidth, post.coverHeight) : TEXT_ONLY_RATIO;
  // width/height 属性让浏览器在图片下载前就预留好位置
  const imgWidth = 480;
  const imgHeight = Math.round(imgWidth * ratio);

  const handleOpenDetail = (event: React.MouseEvent<HTMLAnchorElement>) => {
    // 新标签页打开（Ctrl/⌘/中键）时走浏览器默认行为
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    if (isOpening) return;
    setIsOpening(true);
    window.setTimeout(() => {
      router.push(`/posts/${post.id}`);
    }, 250);
  };

  return (
    <article
      className={`group relative overflow-hidden rounded-xl bg-white transition-transform ${isOpening ? 'z-30 scale-[1.03]' : ''}`}
      style={{ transitionDuration: '250ms' }}
    >
      <div className="relative w-full overflow-hidden rounded-xl bg-slate-100" style={{ aspectRatio: `1 / ${ratio}` }}>
        {cover && !failed ? (
          <img
            src={cloudinaryThumb(cover, 480)}
            srcSet={cloudinarySrcSet(cover)}
            sizes={cloudinarySrcSet(cover) ? CARD_SIZES : undefined}
            width={imgWidth}
            height={imgHeight}
            alt={post.title}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={priority ? 'high' : 'auto'}
            onError={() => setFailed(true)}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          // 没有图片：文字卡片
          <div className="absolute inset-0 flex items-center bg-gradient-to-br from-rose-50 to-orange-50 px-4 pb-4 pt-9">
            <p className="line-clamp-6 text-[15px] font-semibold leading-relaxed text-slate-700">
              {post.content?.trim() || post.title}
            </p>
          </div>
        )}
        {post.city && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[10px] text-white backdrop-blur-md">
            <MapPin className="h-3 w-3" /> {displayCityName(post.city)}
          </span>
        )}
        {images.length > 1 && (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[10px] text-white backdrop-blur-md">
            <Images className="h-3 w-3" /> {images.length}
          </span>
        )}
      </div>

      <div className="px-1.5 pb-2 pt-2">
        <h3 className="line-clamp-2 text-[14px] font-medium leading-[1.4] text-slate-900">{post.title}</h3>

        <div className="mt-1.5 flex items-center justify-between gap-2">
          {post.userId ? (
            <Link
              href={userPath(post.userId)}
              className="relative z-20 flex min-w-0 items-center gap-1.5 hover:opacity-80"
              aria-label={`作者：${post.userName || '匿名用户'}`}
            >
              <Avatar src={post.userImage} name={post.userName} />
              <span className="truncate text-[12px] text-slate-500">{post.userName || '匿名用户'}</span>
            </Link>
          ) : (
            <div className="flex min-w-0 items-center gap-1.5">
              <Avatar src={post.userImage} name={post.userName} />
              <span className="truncate text-[12px] text-slate-500">{post.userName || '匿名用户'}</span>
            </div>
          )}

          <ReactionButton kind="like" postId={post.id} initialCount={post.likeCount ?? 0} variant="card" />
        </div>
      </div>

      <a
        href={`/posts/${post.id}`}
        onClick={handleOpenDetail}
        className="absolute inset-0 z-10"
        aria-label={`查看详情：${post.title}`}
      />
    </article>
  );
}

function Avatar({ src, name }: { src?: string | null; name?: string | null }) {
  return (
    <span className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-slate-200">
      {src ? (
        <img src={cloudinaryThumb(src, 64)} alt="" width={20} height={20} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-rose-500 text-[10px] font-bold text-white">
          {name?.[0] || 'U'}
        </span>
      )}
    </span>
  );
}
