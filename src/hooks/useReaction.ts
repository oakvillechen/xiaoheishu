'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';

export type ReactionKind = 'like' | 'favorite';
export type ReactionData = { count: number; active: boolean; available: boolean };

const LABEL: Record<ReactionKind, string> = { like: '点赞', favorite: '收藏' };

/** 缓存 key 带上当前用户，切换账号 / 退出登录时自然换一份数据 */
export function reactionKey(kind: ReactionKind, postId: number, uid: string | null | undefined) {
  return ['reaction', kind, postId, uid || 'anon'] as const;
}

async function authHeaders(user: ReturnType<typeof useAuth>['user']) {
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

/**
 * 点赞 / 收藏状态 + 切换（乐观更新）。
 * @param fetchOnMount 详情页传 true：挂载后向服务器取最新计数和自己的状态；首页卡片传 false，
 *                     计数来自帖子列表，自己的状态由 Feed 批量查询后写进缓存。
 */
export function useReaction(kind: ReactionKind, postId: number, initialCount: number, fetchOnMount: boolean) {
  const { user, loading, login } = useAuth();
  const queryClient = useQueryClient();
  const key = reactionKey(kind, postId, user?.uid);

  const query = useQuery<ReactionData>({
    queryKey: key,
    queryFn: async () => {
      const res = await axios.get(`/api/posts/${postId}/${kind}`, { headers: await authHeaders(user) });
      return { count: res.data.count ?? 0, active: Boolean(res.data.active), available: res.data.available !== false };
    },
    initialData: { count: initialCount, active: false, available: true },
    initialDataUpdatedAt: 0,
    enabled: fetchOnMount && !loading,
    staleTime: fetchOnMount ? 30_000 : Infinity,
  });

  const mutation = useMutation({
    mutationFn: async (nextActive: boolean) => {
      const headers = await authHeaders(user);
      const res = nextActive
        ? await axios.post(`/api/posts/${postId}/${kind}`, null, { headers })
        : await axios.delete(`/api/posts/${postId}/${kind}`, { headers });
      return { count: res.data.count ?? 0, active: Boolean(res.data.active), available: true } as ReactionData;
    },
    onMutate: async (nextActive: boolean) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ReactionData>(key);
      const base = previous ?? { count: initialCount, active: false, available: true };
      queryClient.setQueryData<ReactionData>(key, {
        ...base,
        active: nextActive,
        count: Math.max(0, base.count + (nextActive === base.active ? 0 : nextActive ? 1 : -1)),
      });
      return { previous };
    },
    onError: (error, _next, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status === 503) {
        queryClient.setQueryData<ReactionData>(key, (old) => ({ ...(old ?? context?.previous ?? { count: 0, active: false }), available: false }));
        alert(`${LABEL[kind]}功能暂未开放，请稍后再试`);
      } else if (status === 429) {
        alert('操作太频繁了，请稍后再试');
      } else if (status === 401) {
        alert('登录已过期，请重新登录');
      } else {
        alert(`${LABEL[kind]}失败，请稍后重试`);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(key, data);
      if (kind === 'favorite') void queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  const toggle = async () => {
    if (loading || mutation.isPending) return;
    if (!user) {
      if (window.confirm(`登录后才能${LABEL[kind]}，现在登录吗？`)) {
        try {
          await login();
        } catch (error) {
          alert(error instanceof Error ? error.message : '登录失败，请稍后重试');
        }
      }
      return;
    }
    if (query.data && !query.data.available) {
      alert(`${LABEL[kind]}功能暂未开放，请稍后再试`);
      return;
    }
    mutation.mutate(!query.data?.active);
  };

  return { data: query.data, toggle, isPending: mutation.isPending };
}
