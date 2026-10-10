import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import LandingPage from '@/components/seo/LandingPage';
import { listLatestPosts } from '@/lib/posts-server';
import { DEFAULT_OG_IMAGE, cityFromSlug, cityPath, toSlug } from '@/lib/site';

// ISR：首次访问时渲染，缓存 5 分钟；build 时不访问数据库
export const revalidate = 300;

// 返回空数组：build 时不预渲染任何页面（不需要数据库），首次访问时生成并按 revalidate 缓存
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

function copy(city: { en: string; cn: string }) {
  const heading = `${city.cn}（${city.en}）华人生活`;
  const intro = `${city.cn}华人社区最新分享：${city.cn}租房、买房、留学、移民、找工作、美食探店和本地新闻，来自${city.cn}及大多伦多地区华人的真实经验。`;
  return { heading, intro };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const city = cityFromSlug(slug);
  if (!city) return { title: '页面不存在', robots: { index: false } };
  const { heading, intro } = copy(city);
  const path = cityPath(city.en);
  return {
    title: `${city.cn}租房·留学·移民·生活`,
    description: intro,
    keywords: [`${city.cn}租房`, `${city.cn}华人`, `${city.en} 华人`, `${city.cn}留学`, `${city.cn}买房`, `${city.cn}美食`],
    alternates: { canonical: path },
    openGraph: { type: 'website', url: path, title: heading, description: intro, images: [DEFAULT_OG_IMAGE] },
    twitter: { card: 'summary_large_image', title: heading, description: intro, images: [DEFAULT_OG_IMAGE.url] },
  };
}

export default async function CityPage({ params }: Props) {
  const { slug } = await params;
  const city = cityFromSlug(slug);
  if (!city) notFound();
  if (slug !== toSlug(city.en)) permanentRedirect(cityPath(city.en));

  const initialPage = JSON.parse(JSON.stringify(await listLatestPosts({ city: city.en, limit: 20 })));
  const { heading, intro } = copy(city);

  return (
    <LandingPage
      kind="city"
      activeEn={city.en}
      heading={heading}
      intro={intro}
      path={cityPath(city.en)}
      filter={{ city: city.en }}
      initialPage={initialPage}
    />
  );
}
