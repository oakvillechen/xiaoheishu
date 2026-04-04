'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/layout/Header';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Loader2, ArrowLeft, MessageCircle, Heart, Share2, MapPin, Calendar, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { use } from 'react';

export default function PostDetail({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const galleryRef = useRef<HTMLDivElement | null>(null);

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

  const handleGalleryScroll = () => {
    const gallery = galleryRef.current;
    if (!gallery || gallery.clientWidth === 0) {
      return;
    }

    const index = Math.round(gallery.scrollLeft / gallery.clientWidth);
    setActiveImageIndex(index);
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
    <main className="min-h-screen bg-slate-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link href="/" className="inline-flex items-center text-slate-500 hover:text-rose-500 transition-colors mb-6 group">
          <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          返回首页
        </Link>

        <article className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100">
          {imageUrls.length > 0 && (
            <div className="relative">
              <div
                ref={galleryRef}
                className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
                onScroll={handleGalleryScroll}
              >
                {imageUrls.map((url, index) => (
                  <div key={url} className="w-full shrink-0 aspect-[3/4] snap-start">
                    <img
                      src={url}
                      alt={`${post.title}-${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>

              <div className="absolute top-4 left-4">
                {post.city && (
                  <span className="bg-black/40 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {post.city}
                  </span>
                )}
              </div>

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                {imageUrls.map((_, index) => (
                  <span
                    key={index}
                    className={`h-1.5 rounded-full transition-all ${index === activeImageIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/60'}`}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="p-8 md:p-12">
            <div className="flex items-center gap-3 mb-6 text-sm text-slate-400">
              <span className="bg-rose-50 text-rose-500 px-3 py-1 rounded-full font-bold">
                {post?.category || '生活'}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> 
                {new Date(post?.createdAt).toLocaleDateString()}
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-8 leading-tight">
              {post?.title}
            </h1>

            <div className="flex items-center justify-between py-6 border-y border-slate-50 mb-8">
               <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-100 overflow-hidden border">
                    {post?.userImage ? (
                      <img src={post.userImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="flex items-center justify-center h-full w-full font-bold text-slate-400">
                        {post?.userName?.[0]}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{post?.userName || '匿名用户'}</p>
                    <p className="text-xs text-slate-400">发布于小黑书</p>
                  </div>
               </div>
               
               <div className="flex items-center gap-2">
                 <Button variant="outline" size="sm" className="rounded-full" onClick={handleShare}>
                    <Share2 className="h-4 w-4 mr-1" /> 转发
                 </Button>
               </div>
            </div>

            {/* Post Content */}
            <div className="prose prose-slate max-w-none mb-12">
               <div className="text-slate-700 text-lg leading-relaxed whitespace-pre-wrap">
                  {post?.content}
               </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-12">
               {post?.tags?.split(',').map((tag: string) => (
                  <span key={tag} className="text-sm text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                     {tag}
                  </span>
               ))}
            </div>

            {/* Interaction Stats */}
            <div className="flex items-center gap-8 py-6 border-t border-slate-50">
               <button className="flex items-center gap-2 text-slate-400 hover:text-rose-500 transition-colors">
                  <Heart className="h-6 w-6" />
                  <span className="font-bold">2.4k</span>
               </button>
               <button className="flex items-center gap-2 text-slate-400 hover:text-rose-500 transition-colors">
                  <MessageCircle className="h-6 w-6" />
                  <span className="font-bold">{comments.length}</span>
               </button>
            </div>
          </div>
        </article>

        {/* Comment Section */}
        <section className="mt-12 bg-white rounded-3xl p-8 shadow-sm border border-slate-100" id="comments">
           <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-rose-500" />
              全部评论 ({comments.length})
           </h3>

           {user ? (
             <div className="flex gap-4 mb-12">
                <div className="h-10 w-10 shrink-0 rounded-full bg-slate-100 overflow-hidden border">
                   {user.photoURL ? <img src={user.photoURL} alt="" /> : null}
                </div>
                <div className="flex-1 space-y-3">
                   <Textarea 
                      placeholder="写下你的看法..." 
                      className="rounded-2xl border-slate-100 focus:border-rose-500 focus:ring-rose-200 resize-none"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                   />
                   <div className="flex justify-end">
                      <Button 
                         onClick={handleCommentSubmit} 
                         disabled={commentMutation.isPending || !comment.trim()}
                         className="bg-rose-500 hover:bg-rose-600 rounded-full"
                      >
                         {commentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                         发布评论
                      </Button>
                   </div>
                </div>
             </div>
           ) : (
             <div className="bg-slate-50 rounded-2xl p-8 text-center mb-12 border border-dashed border-slate-200">
               <p className="text-slate-500 mb-4">登录后即可发表评论</p>
               <Button variant="outline" className="rounded-full">立即登录</Button>
             </div>
           )}

           <div className="space-y-8">
              {comments.map((c: any) => (
                <div key={c.id} className="flex gap-4 group">
                   <div className="h-10 w-10 shrink-0 rounded-full bg-slate-100 overflow-hidden">
                      {c.userImage ? <img src={c.userImage} alt="" className="w-full h-full object-cover" /> : null}
                   </div>
                   <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                         <span className="font-bold text-sm">{c.userName || '匿名用户'}</span>
                         <span className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-slate-700 leading-relaxed">{c.content}</p>
                   </div>
                </div>
              ))}
              
              {comments.length === 0 && (
                <div className="text-center py-12 text-slate-300">
                   <p className="italic">还没有人评论过，快来抢沙发！</p>
                </div>
              )}
           </div>
        </section>
      </div>
    </main>
  );
}
