import type { Metadata } from 'next';
import FavoritesClient from '@/components/me/FavoritesClient';

export const metadata: Metadata = {
  title: '我的收藏',
  robots: { index: false, follow: false },
};

export default function FavoritesPage() {
  return <FavoritesClient />;
}
