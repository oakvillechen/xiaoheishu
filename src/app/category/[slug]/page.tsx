import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import LandingPage from '@/components/seo/LandingPage';
import { listLatestPosts } from '@/lib/posts-server';
import { DEFAULT_OG_IMAGE, categoryFromSlug, categoryPath, toSlug } from '@/lib/site';

// ISR：首次访问时渲染，缓存 5 分钟；build 时不访问数据库
export const revalidate = 300;

// 返回空数组：build 时不预渲染任何页面（不需要数据库），首次访问时生成并按 revalidate 缓存
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

const INTROS: Record<string, string> = {
  Life: '加拿大华人日常生活经验：衣食住行、办事攻略、季节提醒和社区互助。',
  Food: '多伦多及大多伦多地区华人美食探店：中餐、火锅、奶茶、早茶和各国美食推荐。',
  Travel: '加拿大及周边旅行攻略：自驾路线、枫叶季、滑雪、国家公园和周末去哪玩。',
  RealEstate: '多伦多及 GTA 买房卖房：新盘速览、楼市数据、贷款利率和置业经验。',
  Rental: '多伦多及 GTA 租房：租房攻略、租金走势、找房避坑、租约和押金须知，新移民和留学生必看。',
  Job: '加拿大找工作和职场：就业数据、求职经验、简历面试和行业动态。',
  Study: '加拿大留学：选校、申请、学签、校园生活和毕业工签经验分享。',
  Immigration: '加拿大移民：EE、省提名、家庭团聚、PR 卡、入籍和最新移民政策解读。',
  News: '加拿大和多伦多本地新闻：与华人生活相关的政策、经济、交通和社区资讯。',
};

function copy(cat: { en: string; cn: string }) {
  const heading = `${cat.cn} · 加拿大华人社区`;
  const intro = INTROS[cat.en] || `加拿大华人社区「${cat.cn}」最新分享。`;
  return { heading, intro };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cat = categoryFromSlug(slug);
  if (!cat) return { title: '页面不存在', robots: { index: false } };
  const { heading, intro } = copy(cat);
  const path = categoryPath(cat.en);
  return {
    title: `${cat.cn} - 多伦多及加拿大华人${cat.cn}分享`,
    description: intro,
    alternates: { canonical: path },
    openGraph: { type: 'website', url: path, title: heading, description: intro, images: [DEFAULT_OG_IMAGE] },
    twitter: { card: 'summary_large_image', title: heading, description: intro, images: [DEFAULT_OG_IMAGE.url] },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const cat = categoryFromSlug(slug);
  if (!cat) notFound();
  if (slug !== toSlug(cat.en)) permanentRedirect(categoryPath(cat.en));

  const initialPage = JSON.parse(JSON.stringify(await listLatestPosts({ category: cat.en, limit: 20 })));
  const { heading, intro } = copy(cat);

  return (
    <LandingPage
      kind="category"
      activeEn={cat.en}
      heading={heading}
      intro={intro}
      path={categoryPath(cat.en)}
      filter={{ category: cat.en }}
      initialPage={initialPage}
    />
  );
}
