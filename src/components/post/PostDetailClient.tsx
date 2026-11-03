'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  Loader2,
  MessageCircle,
  Share2,
  MapPin,
  Calendar,
  Send,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { displayCityName, normalizeCityName, CITIES } from '@/lib/constants/cities';
import { cityPath } from '@/lib/site';
import { cloudinaryThumb } from '@/lib/image-url';
import AdminDeletePostButton from '@/components/post/AdminDeletePostButton';
import ReactionButton from '@/components/post/ReactionButton';

type CommentItem = {
  id: number;
  content: string;
  userName?: string | null;
  userImage?: string | null;
  createdAt?: string | null;
};

type PostDetailData = {
  post: {
    id: number;
    title: string;
    content?: string | null;
    imageUrls?: string[];
    city?: string | null;
    tags?: string | null;
    userName?: string | null;
    userId?: string | null;
    userImage?: string | null;
    createdAt?: string | null;
    likeCount?: number;
    favoriteCount?: number;
  };
  comments: CommentItem[];
};

function formatDate(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('zh-CN', { timeZone: 'America/Toronto' });
}

export default function PostDetailClient({ postId, initialData }: { postId: string; initialData: PostDetailData }) {
  const params = { id: postId };
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(true);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [isFollowed, setIsFollowed] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const commentsSectionRef = useRef<HTMLDivElement | null>(null);
  const commentInputRef = useRef<HTMLInputElement | null>(null);

  const { data, isLoading } = useQuery<PostDetailData>({
    queryKey: ['post', params.id],
    queryFn: async () => {
      const res = await axios.get(`/api/posts/${params.id}`);
      return res.data;
    },
    initialData,
    initialDataUpdatedAt: 0,
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 2200);
  };

  const commentMutation = useMutation({
    mutationFn: async (newComment: { postId: number; content: string; userId: string }) => {
      if (!user) {
        throw new Error('请先登录');
      }

      const token = await user.getIdToken();
      return axios.post('/api/comments', newComment, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', params.id] });
      setComment('');
      showToast('评论发表成功！');
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : '评论失败，请重试';
      showToast(msg || '评论失败，请重试');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
      </div>
    );
  }

  const post = data?.post;
  const imageUrls: string[] = post?.imageUrls || [];
  const comments = data?.comments || [];

  const handleClose = () => {
    setIsOpen(false);
    window.setTimeout(() => {
      if (window.history.length > 1) {
        router.back();
      } else {
        router.push('/');
      }
    }, 200);
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  const showPreviousImage = () => {
    if (imageUrls.length <= 1) return;
    setActiveImageIndex((prev) => (prev - 1 + imageUrls.length) % imageUrls.length);
  };

  const showNextImage = () => {
    if (imageUrls.length <= 1) return;
    setActiveImageIndex((prev) => (prev + 1) % imageUrls.length);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) return;
    setTouchStartX(event.touches[0].clientX);
    setTouchStartY(event.touches[0].clientY);
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null || touchStartY === null) return;
    const deltaX = event.changedTouches[0].clientX - touchStartX;
    const deltaY = event.changedTouches[0].clientY - touchStartY;
    setTouchStartX(null);
    setTouchStartY(null);

    // Only swipe if horizontal drag is significantly larger than vertical drag
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      if (deltaX > 0) {
        showPreviousImage();
      } else {
        showNextImage();
      }
    }
  };

  const handleCommentSubmit = () => {
    if (!user) {
      showToast('请先登录后再发表评论');
      return;
    }
    if (!comment.trim()) return;
    commentMutation.mutate({
      postId: parseInt(params.id),
      content: comment.trim(),
      userId: user.uid,
    });
  };

  const handleShare = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
      }
      showToast('链接已复制到剪贴板！');
    } catch {
      showToast('已复制页面链接');
    }
  };

  const scrollToComments = () => {
    commentsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const renderAuthor = (compact = false) => {
    const content = (
      <div className="flex min-w-0 items-center gap-2.5">
        <div className={`${compact ? 'h-8 w-8' : 'h-10 w-10'} shrink-0 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-100`}>
          {post?.userImage ? (
            <img src={cloudinaryThumb(post.userImage, 96)} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className={`flex h-full w-full items-center justify-center font-bold text-rose-500 ${compact ? 'text-xs' : 'text-sm'}`}>
              {post?.userName?.[0] || '匿'}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className={`truncate font-semibold text-slate-900 ${compact ? 'text-xs max-w-[120px]' : 'text-[15px]'}`}>
            {post?.userName || '匿名用户'}
          </p>
          {!compact && <p className="text-xs text-slate-400">{formatDate(post?.createdAt)}</p>}
        </div>
      </div>
    );

    return post?.userId ? (
      <Link href={`/u/${encodeURIComponent(post.userId)}`} className="hover:opacity-85 transition-opacity">
        {content}
      </Link>
    ) : (
      content
    );
  };

  const renderCityTag = () => {
    if (!post?.city) return null;
    const canonicalCity = normalizeCityName(post.city);
    const known = canonicalCity && CITIES.some((c) => c.en === canonicalCity);
    const label = (
      <>
        <MapPin className="h-3.5 w-3.5 text-rose-500" />
        {displayCityName(post.city)}
      </>
    );
    return known ? (
      <Link href={cityPath(canonicalCity)} className="inline-flex items-center gap-1 text-slate-500 hover:text-rose-500">
        {label}
      </Link>
    ) : (
      <span className="inline-flex items-center gap-1 text-slate-500">{label}</span>
    );
  };

  return (
    <>
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[100] bg-slate-900/90 text-white text-xs font-medium px-4 py-2.5 rounded-full shadow-xl backdrop-blur-md transition-all animate-in fade-in duration-200">
          {toastMessage}
        </div>
      )}

      {/* ============================================================== */}
      {/* MOBILE EXPERIENCE: Fullscreen native mobile app note viewer   */}
      {/* ============================================================== */}
      <div className="flex flex-col min-h-screen bg-white text-slate-900 lg:hidden pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        {/* Sticky Mobile App Top Bar */}
        <header className="sticky top-0 z-40 flex h-13 w-full items-center justify-between border-b border-slate-100 bg-white/95 px-3 backdrop-blur-md">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={handleBack}
              className="flex h-10 w-10 items-center justify-center -ml-1 text-slate-700 active:scale-90 transition-transform"
              aria-label="返回"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            {renderAuthor(true)}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsFollowed(!isFollowed)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-all active:scale-95 ${
                isFollowed
                  ? 'border border-slate-200 bg-slate-50 text-slate-500'
                  : 'bg-rose-500 text-white shadow-sm shadow-rose-200'
              }`}
            >
              {isFollowed ? '已关注' : '关注'}
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 active:bg-slate-100 active:scale-95 transition-all"
              aria-label="分享"
            >
              <Share2 className="h-4.5 w-4.5" />
            </button>
          </div>
        </header>

        {/* Mobile Page Content: Natural Scroll Stream */}
        <main className="w-full flex-1">
          {/* Image Carousel */}
          <div
            className="relative w-full bg-slate-950 overflow-hidden flex items-center justify-center min-h-[320px] max-h-[70vh]"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {imageUrls.length > 0 ? (
              <>
                <div
                  className="flex h-full w-full transition-transform duration-300 ease-out"
                  style={{ transform: `translateX(-${activeImageIndex * 100}%)` }}
                >
                  {imageUrls.map((url, index) => (
                    <div key={`${url}-${index}`} className="flex h-full w-full shrink-0 items-center justify-center">
                      <img
                        src={url}
                        alt={`${post?.title || '笔记图片'}-${index + 1}`}
                        className="max-h-[70vh] w-full object-contain"
                      />
                    </div>
                  ))}
                </div>

                {imageUrls.length > 1 && (
                  <>
                    <div className="absolute top-3 right-3 rounded-full bg-black/60 backdrop-blur-md px-2.5 py-0.5 text-[11px] font-semibold text-white">
                      {activeImageIndex + 1}/{imageUrls.length}
                    </div>

                    <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 pointer-events-none">
                      {imageUrls.map((_, index) => (
                        <span
                          key={index}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            index === activeImageIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/40'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="flex h-48 items-center justify-center text-slate-400 text-sm">暂无图片</div>
            )}
          </div>

          {/* Note Body: Complete Full Text & Details */}
          <article className="px-4 pt-4 pb-2">
            <h1 className="text-[19px] font-bold text-slate-900 leading-[1.4] mb-3 select-text">
              {post?.title}
            </h1>

            {/* FULL CONTENT: No height limits, no clipping, fully scrollable */}
            <div className="text-[15px] leading-[1.8] text-slate-800 whitespace-pre-wrap select-text font-normal">
              {post?.content}
            </div>

            {/* Tags */}
            {post?.tags && (
              <div className="mt-4 flex flex-wrap gap-2">
                {post.tags.split(',').map((tag: string) => {
                  const cleaned = tag.trim();
                  if (!cleaned) return null;
                  return (
                    <span
                      key={cleaned}
                      className="inline-flex items-center text-[13px] font-medium text-rose-600 bg-rose-50/80 hover:bg-rose-100 px-2.5 py-1 rounded-full transition-colors"
                    >
                      #{cleaned}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Metadata (Location & Date) */}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              {renderCityTag()}
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(post?.createdAt)}
              </span>
              {post?.id && (
                <div className="ml-auto">
                  <AdminDeletePostButton postId={post.id} />
                </div>
              )}
            </div>
          </article>

          {/* Section Divider */}
          <div className="h-px bg-slate-100 my-4 mx-4" />

          {/* Comments Section */}
          <section ref={commentsSectionRef} className="px-4 pb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                共 {comments.length} 条评论
              </h2>
            </div>

            {comments.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center text-slate-400">
                <MessageCircle className="h-8 w-8 text-slate-300 stroke-[1.5] mb-2" />
                <p className="text-xs text-slate-400">还没有评论，来抢第一条吧～</p>
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map((c: CommentItem) => (
                  <div key={c.id} className="flex gap-2.5">
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-100">
                      {c.userImage ? (
                        <img src={c.userImage} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-400">
                          {c.userName?.[0] || '匿'}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold text-slate-700">
                          {c.userName || '匿名用户'}
                        </span>
                        <span className="text-[11px] text-slate-400">刚刚</span>
                      </div>
                      <p className="text-[14px] leading-relaxed text-slate-800 mt-0.5">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>

        {/* Fixed Mobile App Bottom Bar */}
        <footer className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] flex items-center gap-2">
          {/* Comment Input Pill */}
          <div className="flex-1 flex items-center bg-slate-100 rounded-full px-3 h-9.5 text-sm transition-all focus-within:bg-white focus-within:ring-2 focus-within:ring-rose-500/20 focus-within:border focus-within:border-rose-400">
            <input
              ref={commentInputRef}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleCommentSubmit();
                }
              }}
              placeholder={user ? '说点什么...' : '登录后评论'}
              disabled={!user}
              className="w-full bg-transparent text-xs text-slate-800 placeholder:text-slate-400 outline-none"
            />
            {comment.trim() && (
              <button
                type="button"
                onClick={handleCommentSubmit}
                disabled={commentMutation.isPending}
                className="shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-rose-500 text-white active:scale-95 transition-all"
                aria-label="发送评论"
              >
                {commentMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-3 pr-1 text-slate-600">
            {post?.id && (
              <>
                <ReactionButton kind="like" postId={post.id} initialCount={post.likeCount ?? 0} fetchOnMount />
                <ReactionButton kind="favorite" postId={post.id} initialCount={post.favoriteCount ?? 0} fetchOnMount />
              </>
            )}

            {/* Comment Scroll Button */}
            <button
              type="button"
              onClick={scrollToComments}
              className="flex items-center gap-1 active:scale-90 transition-transform text-slate-600"
              aria-label="查看评论"
            >
              <MessageCircle className="h-5 w-5" />
              <span className="text-xs font-medium">{comments.length}</span>
            </button>
          </div>
        </footer>
      </div>

      {/* ============================================================== */}
      {/* DESKTOP EXPERIENCE: Classic Xiaohongshu Web Modal with Scroll  */}
      {/* ============================================================== */}
      <div className="hidden lg:flex fixed inset-0 z-50 items-center justify-center p-6">
        <button
          type="button"
          onClick={handleClose}
          aria-label="关闭详情"
          className={`absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in-0 ${
            isOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <section
          className={`relative z-10 flex h-[90vh] w-[96vw] max-w-[1440px] overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-300 animate-in fade-in-0 zoom-in-95 ${
            isOpen ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-[0.96] opacity-0'
          }`}
        >
          {/* Close button top right */}
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-4 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Left: Desktop Image Carousel */}
          <div className="relative h-full flex-[0_0_60%] overflow-hidden bg-black flex items-center justify-center select-none">
            {imageUrls.length > 0 ? (
              <>
                <div
                  className="flex h-full w-full transition-transform duration-300"
                  style={{ transform: `translateX(-${activeImageIndex * 100}%)` }}
                >
                  {imageUrls.map((url, index) => (
                    <div key={`${url}-${index}`} className="flex h-full w-full shrink-0 items-center justify-center">
                      <img
                        src={url}
                        alt={`${post?.title || '笔记图片'}-${index + 1}`}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  ))}
                </div>

                {imageUrls.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={showPreviousImage}
                      className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                      aria-label="上一张图片"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>

                    <button
                      type="button"
                      onClick={showNextImage}
                      className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                      aria-label="下一张图片"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>

                    <div className="absolute right-4 top-4 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white">
                      {activeImageIndex + 1}/{imageUrls.length}
                    </div>

                    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
                      {imageUrls.map((_, index) => (
                        <span
                          key={index}
                          className={`h-2 rounded-full transition-all duration-300 ${
                            index === activeImageIndex ? 'w-5 bg-white' : 'w-2 bg-white/50'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-500">暂无图片</div>
            )}
          </div>

          {/* Right: Desktop Content & Comments */}
          <aside className="flex flex-1 flex-col h-full overflow-hidden border-l border-slate-100 bg-white">
            {/* Desktop Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              {renderAuthor(false)}

              <button
                type="button"
                onClick={() => setIsFollowed(!isFollowed)}
                className={`h-8 px-4 rounded-full text-xs font-semibold transition-all ${
                  isFollowed
                    ? 'border border-slate-200 bg-slate-50 text-slate-600'
                    : 'bg-rose-500 text-white hover:bg-rose-600'
                }`}
              >
                {isFollowed ? '已关注' : '关注'}
              </button>
            </div>

            {/* Desktop Scrollable Body (Both Content & Comments scroll together!) */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <h1 className="mb-3 text-[20px] font-bold leading-snug text-slate-900 select-text">
                {post?.title}
              </h1>

              {/* Full Content */}
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700 select-text font-normal">
                {post?.content}
              </p>

              {/* Tags */}
              {post?.tags && (
                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  {post.tags.split(',').map((tag: string) => {
                    const cleaned = tag.trim();
                    if (!cleaned) return null;
                    return (
                      <span key={cleaned} className="font-medium text-rose-500 hover:underline cursor-pointer">
                        #{cleaned}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Metadata */}
              <div className="mt-4 flex items-center gap-3 text-xs text-slate-400">
                {renderCityTag()}
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(post?.createdAt)}
                </span>
                {post?.id && (
                  <div className="ml-auto">
                    <AdminDeletePostButton postId={post.id} />
                  </div>
                )}
              </div>

              <div className="my-6 h-px bg-slate-100" />

              {/* Comments */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
                  共 {comments.length} 条评论
                </p>

                {comments.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">还没有评论，来抢第一条</p>
                ) : (
                  <div className="space-y-4">
                    {comments.map((c: CommentItem) => (
                      <div key={c.id} className="flex gap-3">
                        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-slate-100">
                          {c.userImage ? (
                            <img src={c.userImage} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-400">
                              {c.userName?.[0] || '匿'}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-slate-800">{c.userName || '匿名用户'}</p>
                          <p className="text-[14px] leading-relaxed text-slate-600 mt-0.5">{c.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Desktop Pinned Footer */}
            <div className="border-t border-slate-100 bg-white p-4">
              <div className="flex items-center gap-2">
                <input
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleCommentSubmit();
                    }
                  }}
                  placeholder={user ? '写下你的评论...' : '登录后评论'}
                  disabled={!user}
                  className="h-10 flex-1 rounded-full border border-slate-200 px-4 text-sm outline-none focus:border-rose-400 transition-colors"
                />
                <Button
                  onClick={handleCommentSubmit}
                  disabled={commentMutation.isPending || !comment.trim() || !user}
                  className="h-10 rounded-full bg-rose-500 px-4 hover:bg-rose-600 transition-colors"
                >
                  {commentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>

              <div className="mt-3 flex items-center justify-end gap-3 text-slate-500">
                {post?.id && (
                  <>
                    <ReactionButton kind="like" postId={post.id} initialCount={post.likeCount ?? 0} fetchOnMount />
                    <ReactionButton kind="favorite" postId={post.id} initialCount={post.favoriteCount ?? 0} fetchOnMount />
                  </>
                )}
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex items-center gap-1 hover:text-slate-800 transition-colors"
                  aria-label="分享"
                >
                  <Share2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </>
  );
}
