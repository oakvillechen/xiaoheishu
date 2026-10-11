import type { MetadataRoute } from 'next';
import { TAB_CITIES } from '@/lib/constants/cities';
import { CATEGORIES } from '@/lib/constants/categories';
import { listPostIdsForSitemap, listUserIdsWithPosts } from '@/lib/posts-server';
import { SITE_URL, categoryPath, cityPath } from '@/lib/site';

// 每次请求时生成（搜索引擎抓取频率很低，成本可忽略）；build 时不访问数据库
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: 'hourly', priority: 1 },
    ...TAB_CITIES.map((c) => ({
      url: `${SITE_URL}${cityPath(c.en)}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    ...CATEGORIES.map((c) => ({
      url: `${SITE_URL}${categoryPath(c.en)}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ];

  try {
    const rows = await listPostIdsForSitemap();
    for (const row of rows) {
      entries.push({
        url: `${SITE_URL}/posts/${row.id}`,
        lastModified: row.createdAt ?? undefined,
        changeFrequency: 'weekly',
        priority: 0.6,
      });
    }
  } catch (error) {
    // 数据库不可用时仍返回静态部分，不让 sitemap 整体 500
    console.error('[sitemap] failed to load posts:', error);
  }

  try {
    // 只收录发过笔记的用户主页
    const authors = await listUserIdsWithPosts();
    for (const row of authors) {
      entries.push({
        url: `${SITE_URL}/u/${encodeURIComponent(row.userId)}`,
        lastModified: row.lastPostAt ? new Date(Number(row.lastPostAt) * 1000) : undefined,
        changeFrequency: 'weekly',
        priority: 0.5,
      });
    }
  } catch (error) {
    console.error('[sitemap] failed to load authors:', error);
  }

  return entries;
}
