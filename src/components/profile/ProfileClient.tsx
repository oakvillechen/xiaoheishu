'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PencilLine } from 'lucide-react';
import Header from '@/components/layout/Header';
import InfiniteFeed, { type FeedPage } from '@/components/feed/InfiniteFeed';
import { useAuth } from '@/context/AuthContext';
import { cloudinaryThumb } from '@/lib/image-url';
import EditProfileDialog, { type EditableProfile } from './EditProfileDialog';

export type ProfileView = {
  id: string;
  displayName: string | null;
  photoURL: string | null;
  bio: string | null;
  bioAvailable: boolean;
  postCount: number;
  likesReceived: number;
};

type Tab = 'notes' | 'favorites';

export default function ProfileClient({ profile: initial, initialPosts }: { profile: ProfileView; initialPosts: FeedPage }) {
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState(initial);
  const [tab, setTab] = useState<Tab>('notes');
  const [editing, setEditing] = useState(false);
  const isOwner = Boolean(user && user.uid === profile.id);
  const activeTab: Tab = isOwner ? tab : 'notes';
  const name = profile.displayName || '小黑书用户';

  const handleSaved = (next: EditableProfile) => {
    setProfile((p) => ({ ...p, ...next }));
    router.refresh();
  };

  const tabButton = (key: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      aria-pressed={activeTab === key}
      className={`relative px-1 pb-2 text-[15px] transition-colors ${
        activeTab === key ? 'font-semibold text-slate-900' : 'text-slate-500 hover:text-slate-800'
      }`}
    >
      {label}
      {activeTab === key && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-rose-500" />}
    </button>
  );

  return (
    <div className="min-h-screen">
      <Header />
      <section className="border-b border-slate-100 bg-white">
        <div className="mx-auto w-full max-w-[1360px] px-4 pt-6 md:pt-10">
          <div className="flex items-start gap-4 md:gap-8">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-slate-100 bg-slate-100 md:h-28 md:w-28">
              {profile.photoURL ? (
                <img src={cloudinaryThumb(profile.photoURL, 240)} alt={name} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-3xl font-bold text-slate-400">{name[0]}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="truncate text-xl font-bold text-slate-900 md:text-2xl">{name}</h1>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <PencilLine className="h-3.5 w-3.5" /> 编辑资料
                  </button>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                {profile.bio || (isOwner ? '还没有简介，点「编辑资料」介绍一下自己吧' : '这个人很神秘，还没有写简介')}
              </p>
              <div className="mt-3 flex gap-5 text-sm text-slate-500">
                <span>
                  <b className="mr-1 text-base text-slate-900">{profile.postCount}</b>笔记
                </span>
                <span>
                  <b className="mr-1 text-base text-slate-900">{profile.likesReceived}</b>获赞
                </span>
              </div>
            </div>
          </div>
          <nav className="mt-6 flex justify-center gap-10" aria-label="主页标签">
            {tabButton('notes', '笔记')}
            {isOwner && tabButton('favorites', '收藏')}
          </nav>
        </div>
      </section>

      <main>
        {activeTab === 'notes' ? (
          <InfiniteFeed
            queryKey={['posts', 'user', profile.id]}
            url={`/api/users/${encodeURIComponent(profile.id)}/posts`}
            initialPage={initialPosts}
            emptyText={isOwner ? '还没有发过笔记，点右上角「发布」分享第一篇吧' : '还没有发过笔记'}
          />
        ) : (
          <InfiniteFeed
            queryKey={['favorites']}
            url="/api/me/favorites"
            auth
            emptyText="还没有收藏，看到喜欢的帖子点一下 ☆ 就能收藏"
            unavailableText="收藏功能暂未开放，请稍后再试"
          />
        )}
      </main>

      {isOwner && editing && (
        <EditProfileDialog
          open={editing}
          onOpenChange={setEditing}
          profile={{ displayName: profile.displayName, photoURL: profile.photoURL, bio: profile.bio }}
          bioAvailable={profile.bioAvailable}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
