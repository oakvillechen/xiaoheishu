import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PostDetailClient from '@/components/post/PostDetailClient';
import JsonLd from '@/components/seo/JsonLd';
import { getPostDetail, parsePostId } from '@/lib/posts-server';
import { displayCityName } from '@/lib/constants/cities';
import { displayCategoryName } from '@/lib/constants/categories';
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL, categoryPath, cityPath, excerpt } from '@/lib/site';
import { normalizeCityName } from '@/lib/constants/cities';
import { normalizeCategory } from '@/lib/constants/categories';

// ISR：页面在第一次访问时从数据库渲染，之后缓存 5 分钟；build 时不访问数据库。
// 修改/删除帖子的接口会调用 revalidatePath 立即刷新。
export const revalidate = 300;

// 返回空数组：build 时不预渲染任何页面（不需要数据库），首次访问时生成并按 revalidate 缓存
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ id: string }> };

async function loadPost(rawId: string) {
  const postId = parsePostId(rawId);
  if (!postId) return null;
  return getPostDetail(postId);
}

function absoluteImage(url: string | undefined) {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const detail = await loadPost(id);
  if (!detail) {
    return { title: '帖子不存在', robots: { index: false, follow: true } };
  }

  const { post } = detail;
  const description = excerpt(post.content, 120) || post.title;
  const cover = absoluteImage(post.imageUrls[0]);
  const url = `/posts/${post.id}`;
  const images = cover ? [{ url: cover, alt: post.title }] : [DEFAULT_OG_IMAGE];
  const keywords = [
    ...(post.tags || '').split(/[,，#\s]+/).map((t) => t.trim()).filter(Boolean),
    post.city ? displayCityName(post.city) : '',
    post.category ? displayCategoryName(post.category) : '',
  ].filter(Boolean);

  return {
    title: post.title,
    description,
    keywords: keywords.length ? keywords : undefined,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title: post.title,
      description,
      siteName: SITE_NAME,
      locale: 'zh_CN',
      publishedTime: post.createdAt ? post.createdAt.toISOString() : undefined,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      images: [cover || DEFAULT_OG_IMAGE.url],
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const detail = await loadPost(id);
  if (!detail) notFound();

  const { post, comments } = detail;
  const url = `${SITE_URL}/posts/${post.id}`;
  const city = normalizeCityName(post.city);
  const category = normalizeCategory(post.category);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SocialMediaPosting',
    '@id': url,
    url,
    mainEntityOfPage: url,
    headline: post.title.slice(0, 110),
    articleBody: post.content || undefined,
    inLanguage: 'zh-CN',
    datePublished: post.createdAt ? post.createdAt.toISOString() : undefined,
    image: post.imageUrls.length ? post.imageUrls.map(absoluteImage) : undefined,
    author: { '@type': 'Person', name: post.userName || '小黑书用户' },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}/icons/icon-512.png` },
    keywords: post.tags || undefined,
    contentLocation: city ? { '@type': 'Place', name: `${displayCityName(city)} ${city}` } : undefined,
    commentCount: comments.length,
    interactionStatistic: {
      '@type': 'InteractionCounter',
      interactionType: 'https://schema.org/CommentAction',
      userInteractionCount: comments.length,
    },
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: SITE_URL },
      ...(city
        ? [{ '@type': 'ListItem', position: 2, name: displayCityName(city), item: `${SITE_URL}${cityPath(city)}` }]
        : category
          ? [{ '@type': 'ListItem', position: 2, name: displayCategoryName(category), item: `${SITE_URL}${categoryPath(category)}` }]
          : []),
      { '@type': 'ListItem', position: city || category ? 3 : 2, name: post.title, item: url },
    ],
  };

  // 转成纯 JSON（Date -> 字符串），和 /api/posts/:id 的返回格式一致
  const initialData = JSON.parse(JSON.stringify({ post, comments }));

  return (
    <>
      <JsonLd data={jsonLd} />
      <JsonLd data={breadcrumb} />
      {/* key：切换到另一篇帖子时重置图片轮播等本地状态 */}
      <PostDetailClient key={post.id} postId={String(post.id)} initialData={initialData} />
    </>
  );
}
