'use client';

import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export const FLASH_MESSAGE_KEY = 'xhs-flash-message';

/**
 * 管理员才能看到的“删除帖子”按钮。
 * 只是界面上的入口；真正的权限校验在服务端 DELETE /api/posts/:id（requireAdmin）。
 */
export default function AdminDeletePostButton({ postId }: { postId: number | string }) {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const { data: isAdmin } = useQuery({
    queryKey: ['me', 'role', user?.uid],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!user) return false;
      const token = await user.getIdToken();
      const res = await axios.get('/api/users/me', { headers: { Authorization: `Bearer ${token}` } });
      return String(res.data?.user?.role || 'user') === 'admin';
    },
  });

  if (!user || !isAdmin) {
    return null;
  }

  const handleDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      const token = await user.getIdToken();
      await axios.delete(`/api/posts/${postId}`, { headers: { Authorization: `Bearer ${token}` } });
      try {
        window.sessionStorage.setItem(FLASH_MESSAGE_KEY, '帖子已删除');
      } catch {
        // sessionStorage 不可用时忽略
      }
      await queryClient.invalidateQueries({ queryKey: ['posts'] });
      setOpen(false);
      router.push('/');
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error || '删除失败，请稍后重试' : '删除失败，请稍后重试';
      setError(String(message));
      setDeleting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
      >
        <Trash2 className="mr-1 h-4 w-4" /> 删除帖子
      </Button>

      <Dialog open={open} onOpenChange={(next) => !deleting && setOpen(next)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>删除帖子</DialogTitle>
            <DialogDescription>确定删除这篇帖子吗？此操作无法撤销</DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
              取消
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />}
              确定删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
