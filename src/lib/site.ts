import { CITIES } from '@/lib/constants/cities';
import { CATEGORIES } from '@/lib/constants/categories';

export const SITE_URL = 'https://xiaoheishu.ca';
export const SITE_NAME = '小黑书';
export const SITE_TITLE = '小黑书 - 加拿大华人生活社区';
export const SITE_DESCRIPTION =
  '小黑书是加拿大华人生活社区：多伦多及大多伦多地区租房、买房、留学、移民、找工作、美食探店和本地新闻，华人新移民和留学生的经验分享。';
export const SITE_KEYWORDS = ['加拿大华人', '多伦多租房', '多伦多留学', '加拿大移民', '多伦多华人', '大多伦多', 'GTA', '新移民', '留学生', '小黑书'];

/** 城市 / 分类的 URL slug：英文规范名转小写、空格转短横线，如 Richmond Hill -> richmond-hill */
export function toSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function cityFromSlug(slug: string) {
  const s = toSlug(decodeURIComponent(slug));
  return CITIES.find((c) => toSlug(c.en) === s) || null;
}

export function categoryFromSlug(slug: string) {
  const s = toSlug(decodeURIComponent(slug));
  return CATEGORIES.find((c) => toSlug(c.en) === s) || null;
}

export function cityPath(en: string) {
  return `/city/${toSlug(en)}`;
}

export function categoryPath(en: string) {
  return `/category/${toSlug(en)}`;
}

/** 把正文压成一行纯文本摘要，用于 meta description */
export function excerpt(text: string | null | undefined, max = 120): string {
  const flat = (text || '').replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return `${Array.from(flat).slice(0, max).join('')}…`;
}

/** 默认分享图（src/app/opengraph-image.tsx 生成） */
export const DEFAULT_OG_IMAGE = { url: '/opengraph-image', width: 1200, height: 630, alt: '小黑书 - 加拿大华人生活社区' };
