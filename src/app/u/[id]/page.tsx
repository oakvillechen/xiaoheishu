import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import JsonLd from '@/components/seo/JsonLd';
import ProfileClient from '@/components/profile/ProfileClient';
import { listLatestPosts } from '@/lib/posts-server';
import { getPublicProfile, isPlausibleUserId } from '@/lib/profiles';
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL, excerpt } from '@/lib/site';

// ISR：首次访问时渲染并缓存 5 分钟；build 时不访问数据库。修改资料后会立即刷新。
export const revalidate = 300;

export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ id: string }> };

async function load(raw: string) {
  const id = decodeURIComponent(raw);
  if (!isPlausibleUserId(id)) return null;
  return getPublicProfile(id);
}

function absolute(url: string | null) {
  if (!url) return undefined;
  return /^https?:\/\//i.test(url) ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await load((await params).id);
  if (!profile) return { title: '用户不存在', robots: { index: false, follow: true } };
  const name = profile.displayName || '小黑书用户';
  const description =
    excerpt(profile.bio, 120) || `${name}在小黑书分享了 ${profile.postCount} 篇笔记，获赞 ${profile.likesReceived}。加拿大华人生活社区。`;
  const path = `/u/${encodeURIComponent(profile.id)}`;
  const avatar = absolute(profile.photoURL);
  return {
    title: `${name}的主页`,
    description,
    alternates: { canonical: path },
    // 没发过笔记的主页没有内容，不让搜索引擎收录
    robots: profile.postCount > 0 ? undefined : { index: false, follow: true },
    openGraph: {
      type: 'profile',
      url: path,
      title: `${name} | ${SITE_NAME}`,
      description,
      images: avatar ? [{ url: avatar, alt: name }] : [DEFAULT_OG_IMAGE],
    },
    twitter: { card: avatar ? 'summary' : 'summary_large_image', title: `${name} | ${SITE_NAME}`, description, images: [avatar || DEFAULT_OG_IMAGE.url] },
  };
}

export default async function UserPage({ params }: Props) {
  const profile = await load((await params).id);
  if (!profile) notFound();

  const initialPosts = JSON.parse(JSON.stringify(await listLatestPosts({ userId: profile.id, limit: 20 })));
  const url = `${SITE_URL}/u/${encodeURIComponent(profile.id)}`;
  const name = profile.displayName || '小黑书用户';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url,
    inLanguage: 'zh-CN',
    dateCreated: profile.createdAt ? profile.createdAt.toISOString() : undefined,
    mainEntity: {
      '@type': 'Person',
      name,
      identifier: profile.id,
      description: profile.bio || undefined,
      image: absolute(profile.photoURL),
      url,
      interactionStatistic: [
        { '@type': 'InteractionCounter', interactionType: 'https://schema.org/WriteAction', userInteractionCount: profile.postCount },
        { '@type': 'InteractionCounter', interactionType: 'https://schema.org/LikeAction', userInteractionCount: profile.likesReceived },
      ],
    },
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <ProfileClient
        key={profile.id}
        profile={{
          id: profile.id,
          displayName: profile.displayName,
          photoURL: profile.photoURL,
          bio: profile.bio,
          bioAvailable: profile.bioAvailable,
          postCount: profile.postCount,
          likesReceived: profile.likesReceived,
        }}
        initialPosts={initialPosts}
      />
    </>
  );
}
