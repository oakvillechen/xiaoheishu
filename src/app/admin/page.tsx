'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Header from '@/components/layout/Header';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ShieldCheck, Trash2, Send } from 'lucide-react';

type AdminUser = {
  id: string;
  role: string;
  displayName: string | null;
  photoURL: string | null;
  email: string;
  phoneNumber: string | null;
  city: string | null;
};

type AdminPost = {
  id: number;
  title: string;
  userName: string | null;
  city: string | null;
  createdAt: string;
};

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [selectedUserId, setSelectedUserId] = useState('');
  const [messageTitle, setMessageTitle] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const [keyword, setKeyword] = useState('');

  const filteredUsers = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return users;

    return users.filter((item) => {
      return (
        item.id.toLowerCase().includes(q) ||
        (item.displayName || '').toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        (item.city || '').toLowerCase().includes(q)
      );
    });
  }, [keyword, users]);

  const authHeaders = async () => {
    if (!user) {
      throw new Error('请先登录');
    }

    const token = await user.getIdToken();
    return {
      Authorization: `Bearer ${token}`,
    };
  };

  const loadAdminData = async () => {
    setLoadingData(true);
    try {
      const headers = await authHeaders();

      const [usersRes, postsRes] = await Promise.all([
        axios.get('/api/admin/users', { headers }),
        axios.get('/api/posts'),
      ]);

      setUsers(usersRes.data?.users || []);
      setPosts(postsRes.data || []);
    } catch (error) {
      console.error('Failed to load admin data:', error);
      alert('加载管理员数据失败');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    let canceled = false;

    const checkRole = async () => {
      if (loading) {
        return;
      }

      if (!user) {
        if (!canceled) {
          setCheckingAccess(false);
          setIsAdmin(false);
        }
        return;
      }

      try {
        const headers = await authHeaders();
        const meRes = await axios.get('/api/users/me', { headers });
        const role = String(meRes.data?.user?.role || 'user');

        if (!canceled) {
          const admin = role === 'admin';
          setIsAdmin(admin);
          setCheckingAccess(false);
          if (admin) {
            await loadAdminData();
          }
        }
      } catch (error) {
        console.error('Failed to check admin role:', error);
        if (!canceled) {
          setCheckingAccess(false);
          setIsAdmin(false);
        }
      }
    };

    void checkRole();

    return () => {
      canceled = true;
    };
  }, [loading, user]);

  const handleDeletePost = async (postId: number) => {
    if (!confirm(`确定删除帖子 #${postId} 吗？`)) {
      return;
    }

    try {
      const headers = await authHeaders();
      await axios.delete(`/api/posts/${postId}`, { headers });
      setPosts((prev) => prev.filter((item) => item.id !== postId));
    } catch (error) {
      console.error('Delete post failed:', error);
      alert('删除帖子失败');
    }
  };

  const handleSendMessage = async () => {
    if (!selectedUserId || !messageTitle.trim() || !messageContent.trim()) {
      alert('请选择用户并填写标题/内容');
      return;
    }

    setSendingMessage(true);
    try {
      const headers = await authHeaders();
      await axios.post(
        '/api/admin/messages',
        {
          toUserId: selectedUserId,
          title: messageTitle.trim(),
          content: messageContent.trim(),
        },
        { headers },
      );

      setMessageTitle('');
      setMessageContent('');
      alert('消息发送成功');
    } catch (error) {
      console.error('Send admin message failed:', error);
      alert('消息发送失败');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleRoleChange = async (targetUserId: string, role: 'admin' | 'user') => {
    try {
      const headers = await authHeaders();
      await axios.patch(
        `/api/admin/users/${targetUserId}/role`,
        { role },
        { headers },
      );

      setUsers((prev) => prev.map((item) => (item.id === targetUserId ? { ...item, role } : item)));
    } catch (error) {
      console.error('Update role failed:', error);
      alert('更新用户角色失败');
    }
  };

  if (loading || checkingAccess) {
    return (
      <main className="min-h-screen bg-slate-50">
        <Header />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50">
        <Header />
        <div className="mx-auto max-w-4xl px-4 py-10">
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">请先登录后访问管理员面板。</p>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-slate-50">
        <Header />
        <div className="mx-auto max-w-4xl px-4 py-10">
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">你当前不是管理员，无法访问该页面。</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <Header />

      <section className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            管理员面板
          </h1>
          <Button onClick={loadAdminData} variant="outline" size="sm" disabled={loadingData}>
            {loadingData ? <Loader2 className="h-4 w-4 animate-spin" /> : '刷新数据'}
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-slate-900">用户列表</h2>

            <div className="mb-3">
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="按昵称/邮箱/城市搜索"
              />
            </div>

            <div className="max-h-[62vh] space-y-2 overflow-y-auto">
              {filteredUsers.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.displayName || '未命名用户'}</p>
                      <p className="truncate text-xs text-slate-500">{item.email}</p>
                      <p className="truncate text-xs text-slate-500">UID: {item.id}</p>
                      <p className="mt-1 text-xs text-slate-500">手机号: {item.phoneNumber || '-'}</p>
                      <p className="text-xs text-slate-500">城市: {item.city || '-'}</p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${item.role === 'admin' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {item.role}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRoleChange(item.id, item.role === 'admin' ? 'user' : 'admin')}
                      >
                        {item.role === 'admin' ? '降级' : '设为管理员'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <div className="space-y-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-slate-900">管理员发消息</h2>

              <div className="space-y-2">
                <select
                  value={selectedUserId}
                  onChange={(event) => setSelectedUserId(event.target.value)}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm"
                >
                  <option value="">选择目标用户</option>
                  {users.map((item) => (
                    <option key={item.id} value={item.id}>
                      {(item.displayName || '未命名用户') + ' · ' + item.email}
                    </option>
                  ))}
                </select>

                <Input
                  value={messageTitle}
                  onChange={(event) => setMessageTitle(event.target.value)}
                  placeholder="消息标题"
                />

                <Textarea
                  value={messageContent}
                  onChange={(event) => setMessageContent(event.target.value)}
                  placeholder="消息内容"
                  className="min-h-24"
                />

                <Button onClick={handleSendMessage} disabled={sendingMessage} className="w-full">
                  {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  发送消息
                </Button>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-slate-900">帖子管理（删帖）</h2>

              <div className="max-h-[38vh] space-y-2 overflow-y-auto">
                {posts.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-100 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="text-xs text-slate-500">#{item.id} · {item.userName || '匿名用户'} · {item.city || '未填写城市'}</p>
                      </div>

                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeletePost(item.id)}
                        className="shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        删除
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
