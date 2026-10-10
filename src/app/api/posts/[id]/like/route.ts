import { reactionHandlers } from '@/lib/reaction-route';

export const dynamic = 'force-dynamic';

export const { GET, POST, DELETE } = reactionHandlers('like');
