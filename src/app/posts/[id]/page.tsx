'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Loader2, MessageCircle, Heart, Share2, MapPin, Calendar, Send, ChevronLeft, ChevronRight, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { use } from 'react';

export default function PostDetail({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['post', params.id],
    queryFn: async () => {
      const res = await axios.get(`/api/posts/${params.id}`);
      return res.data;
    }
  });

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
    }
  });

  useEffect(() => {
    setActiveImageIndex(0);
  }, [params.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsOpen(true);
    }, 10);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
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
      router.push('/');
    }, 300);
  };

  const showPreviousImage = () => {
    if (imageUrls.length <= 1) {
      return;
    }

    setActiveImageIndex((prev) => (prev - 1 + imageUrls.length) % imageUrls.length);
  };

  const showNextImage = () => {
    if (imageUrls.length <= 1) {
      return;
    }

    setActiveImageIndex((prev) => (prev + 1) % imageUrls.length);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) {
      return;
    }

    setTouchStartX(event.touches[0].clientX);
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null) {
      return;
    }

    const deltaX = event.changedTouches[0].clientX - touchStartX;
    setTouchStartX(null);

    if (Math.abs(deltaX) < 40) {
      return;
    }

    if (deltaX > 0) {
      showPreviousImage();
      return;
    }

    showNextImage();
  };

  const handleCommentSubmit = () => {
    if (!user || !comment.trim()) return;
    commentMutation.mutate({
      postId: parseInt(params.id),
      content: comment,
      userId: user.uid
    });
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('链接已复制到剪贴板！');
  };

  return (
    <main className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6">
      <button
        type="button"
        onClick={handleClose}
        aria-label="关闭详情"
        className={`absolute inset-0 bg-black/70 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
      />

      <section
        className={`relative z-10 flex h-[90vh] w-[96vw] max-w-[1460px] gap-4 overflow-hidden rounded-2xl bg-white transition-all duration-300 max-lg:h-[94vh] max-lg:flex-col ${isOpen ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-[0.96] opacity-0'}`}
      >
        <div
          className="relative h-full flex-[0_0_60%] overflow-hidden bg-black max-lg:flex-[0_0_58%]"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {imageUrls.length > 0 ? (
            <>
              <div
                className="flex h-full w-full transition-transform duration-300"
                style={{ transform: `translateX(-${activeImageIndex * 100}%)` }}
              >
                {imageUrls.map((url, index) => (
                  <div key={`${url}-${index}`} className="h-full w-full shrink-0">
                    <img src={url} alt={`${post.title}-${index + 1}`} className="h-full w-full object-contain" />
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
                        className={`h-2 w-2 rounded-full transition-all ${index === activeImageIndex ? 'bg-white' : 'bg-white/55'}`}
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

        <aside className="h-full flex-[0_0_35%] overflow-hidden border-l border-slate-100 px-4 py-4 max-lg:border-l-0 max-lg:border-t max-lg:px-3">
          <div className="flex h-full flex-col">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-100">
                  {post?.userImage ? (
                    <img src={post.userImage} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-400">
                      {post?.userName?.[0] || '匿'}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-semibold text-slate-900">{post?.userName || '匿名用户'}</p>
                  <p className="text-xs text-slate-400">刚刚</p>
                </div>
              </div>

              <button className="h-9 w-20 rounded-full bg-rose-500 text-sm font-semibold text-white hover:bg-rose-600">
                关注
              </button>
            </div>

            <div className="mb-4">
              <h1 className="mb-2 text-[18px] font-bold leading-snug text-slate-900">{post?.title}</h1>
              <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
                {post?.city && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {post.city}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(post?.createdAt).toLocaleDateString()}
                </span>
              </div>

              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{post?.content}</p>

              {post?.tags && (
                <div className="mt-2 flex flex-wrap gap-2 text-[14px]">
                  {post.tags.split(',').map((tag: string) => (
                    <span key={tag} className="text-slate-500">#{tag.trim()}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto border-y border-slate-100 py-3">
              {comments.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-400">还没有评论，来抢第一条</p>
              )}

              <div className="space-y-4">
                {comments.map((c: any) => (
                  <div key={c.id} className="flex gap-2.5">
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-slate-100">
                      {c.userImage ? <img src={c.userImage} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-slate-800">{c.userName || '匿名用户'}</p>
                      <p className="text-[14px] leading-[1.45] text-slate-600">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3">
              <div className="flex items-center gap-2">
                <input
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder={user ? '写下你的评论...' : '登录后评论'}
                  disabled={!user}
                  className="h-10 flex-1 rounded-full border border-slate-200 px-4 text-sm outline-none focus:border-rose-400"
                />
                <Button
                  onClick={handleCommentSubmit}
                  disabled={commentMutation.isPending || !comment.trim() || !user}
                  className="h-10 rounded-full bg-rose-500 px-4 hover:bg-rose-600"
                >
                  {commentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>

              <div className="mt-3 flex items-center justify-end gap-3 text-slate-500">
                <button className="inline-flex h-6 w-6 items-center justify-center" aria-label="点赞">
                  <Heart className="h-5 w-5" />
                </button>
                <button className="inline-flex h-6 w-6 items-center justify-center" aria-label="收藏">
                  <Bookmark className="h-5 w-5" />
                </button>
                <button className="inline-flex h-6 w-6 items-center justify-center" aria-label="评论">
                  <MessageCircle className="h-5 w-5" />
                </button>
                <button onClick={handleShare} className="inline-flex h-6 w-6 items-center justify-center" aria-label="分享">
                  <Share2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
