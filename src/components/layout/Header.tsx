'use client';

import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, User, Plus } from 'lucide-react';
import Link from 'next/link';
import CreatePostModal from '@/components/feed/CreatePostModal';

export default function Header() {
  const { user, login, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md dark:bg-slate-950/80">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold bg-gradient-to-r from-rose-500 to-orange-500 bg-clip-text text-transparent">
            小黑书
          </span>
          <span className="hidden sm:inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-rose-100 text-rose-600">
            枫叶之国 🇨🇦
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <div className="hidden md:flex items-center gap-2 mr-2">
                 <div className="h-8 w-8 rounded-full bg-slate-100 overflow-hidden border">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="flex items-center justify-center h-full w-full text-xs font-bold text-slate-400">
                        {user.displayName?.[0] || 'U'}
                      </span>
                    )}
                 </div>
                 <span className="text-xs font-medium text-slate-600 truncate max-w-[80px]">
                   {user.displayName || '我的'}
                 </span>
              </div>
              <CreatePostModal />
              <Button variant="ghost" size="sm" onClick={logout} className="rounded-full text-slate-500">
                退出
              </Button>
            </>
          ) : (
            <Button onClick={login} size="sm" className="rounded-full bg-rose-500 hover:bg-rose-600">
              <LogIn className="h-4 w-4 mr-1" /> 登录 / 注册
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
