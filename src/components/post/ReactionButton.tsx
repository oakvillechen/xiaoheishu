'use client';

import { Heart, Star } from 'lucide-react';
import { useReaction, type ReactionKind } from '@/hooks/useReaction';

const META: Record<ReactionKind, { label: string; undo: string; Icon: typeof Heart; on: string }> = {
  like: { label: '点赞', undo: '取消点赞', Icon: Heart, on: 'fill-rose-500 text-rose-500' },
  favorite: { label: '收藏', undo: '取消收藏', Icon: Star, on: 'fill-amber-400 text-amber-400' },
};

export default function ReactionButton({
  kind,
  postId,
  initialCount = 0,
  fetchOnMount = false,
  variant = 'detail',
}: {
  kind: ReactionKind;
  postId: number;
  initialCount?: number;
  fetchOnMount?: boolean;
  variant?: 'card' | 'detail';
}) {
  const { data, toggle, isPending } = useReaction(kind, postId, initialCount, fetchOnMount);
  const { label, undo, Icon, on } = META[kind];
  const active = Boolean(data?.active);
  const count = data?.count ?? initialCount;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void toggle();
      }}
      disabled={isPending}
      aria-pressed={active}
      aria-label={active ? undo : label}
      title={active ? undo : label}
      className={
        variant === 'card'
          ? 'relative z-20 -mr-1 inline-flex items-center gap-1 rounded-full px-1 py-0.5 text-slate-400 transition-colors hover:text-rose-500'
          : 'inline-flex items-center gap-1 text-slate-500 transition-colors hover:text-slate-800'
      }
    >
      <Icon className={`${variant === 'card' ? 'h-4 w-4' : 'h-5 w-5'} transition-transform ${active ? `${on} scale-110` : ''}`} />
      <span className={variant === 'card' ? 'text-[11px] font-medium' : 'text-xs font-medium'}>{count > 0 ? count : variant === 'card' ? '0' : ''}</span>
    </button>
  );
}
