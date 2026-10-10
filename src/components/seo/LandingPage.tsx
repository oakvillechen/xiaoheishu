import Link from 'next/link';
import Header from '@/components/layout/Header';
import JsonLd from '@/components/seo/JsonLd';
import LandingFeed from '@/components/seo/LandingFeed';
import { TAB_CITIES } from '@/lib/constants/cities';
import { CATEGORIES } from '@/lib/constants/categories';
import { SITE_NAME, SITE_URL, categoryPath, cityPath } from '@/lib/site';
import type { PostCardProps } from '@/components/feed/PostCard';

type Props = {
  kind: 'city' | 'category';
  activeEn: string;
  heading: string;
  intro: string;
  path: string;
  filter: { city?: string; category?: string };
  initialPage: { items: PostCardProps['post'][]; nextCursor: string | null };
};

export default function LandingPage({ kind, activeEn, heading, intro, path, filter, initialPage }: Props) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: heading,
    description: intro,
    url: `${SITE_URL}${path}`,
    inLanguage: 'zh-CN',
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: initialPage.items.slice(0, 20).map((post, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${SITE_URL}/posts/${post.id}`,
        name: post.title,
      })),
    },
  };

  const chip = (href: string, label: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      className={`whitespace-nowrap rounded-full px-3 py-1 text-[12px] transition-colors ${
        active ? 'bg-rose-500 font-semibold text-white' : 'bg-slate-100 font-medium text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen">
      <JsonLd data={jsonLd} />
      <Header />
      <section className="border-b border-slate-100 bg-white">
        <div className="mx-auto w-full max-w-[1360px] px-4 py-3">
          <nav aria-label="面包屑" className="mb-1 text-xs text-slate-400">
            <Link href="/" className="hover:text-slate-600">{SITE_NAME}</Link>
            <span className="mx-1">/</span>
            <span>{kind === 'city' ? '城市' : '分类'}</span>
          </nav>
          <h1 className="text-lg font-bold text-slate-900 md:text-xl">{heading}</h1>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{intro}</p>
          <div className="mt-3 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-2 pb-1">
              {kind === 'city'
                ? [chip('/', '全部城市', false), ...TAB_CITIES.map((c) => chip(cityPath(c.en), c.cn, c.en === activeEn))]
                : [chip('/', '全部', false), ...CATEGORIES.map((c) => chip(categoryPath(c.en), c.cn, c.en === activeEn))]}
            </div>
          </div>
        </div>
      </section>
      <main className="mx-auto w-full max-w-[1360px] px-4 py-4">
        <LandingFeed filter={filter} initialPage={initialPage} emptyText="这里还没有帖子，快来分享第一篇吧！" />
      </main>
    </div>
  );
}
