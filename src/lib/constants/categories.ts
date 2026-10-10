/**
 * 分类定义。数据库统一存英文规范值（en），界面显示中文（cn）。
 */
export type CategoryDef = {
  en: string;
  cn: string;
  aliases?: string[];
};

export const CATEGORIES: CategoryDef[] = [
  { en: 'Life', cn: '生活', aliases: ['吃喝玩乐', '日常', 'Lifestyle'] },
  { en: 'Food', cn: '美食', aliases: ['餐厅', '探店', 'Restaurant'] },
  { en: 'Travel', cn: '旅行', aliases: ['旅游', '出行', 'Trip'] },
  { en: 'RealEstate', cn: '房产', aliases: ['Real Estate', '买房', '地产', '房地产', 'Housing'] },
  { en: 'Rental', cn: '租房', aliases: ['Rent', 'Rentals', '出租', '求租'] },
  { en: 'Job', cn: '职场就业', aliases: ['职场', '工作', '求职', '就业', 'Jobs', 'Career'] },
  { en: 'Study', cn: '留学', aliases: ['学习', '教育', 'Education', 'School'] },
  { en: 'Immigration', cn: '移民', aliases: ['留学移民', '签证', 'Visa'] },
  { en: 'News', cn: '新闻', aliases: ['资讯', '新闻资讯'] },
];

const aliasIndex: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const cat of CATEGORIES) {
    for (const value of [cat.en, cat.cn, ...(cat.aliases || [])]) {
      map.set(value.trim().toLowerCase(), cat.en);
    }
  }
  return map;
})();

/** 已知分类返回英文规范值；未知分类保留原文；空值返回 null。 */
export function normalizeCategory(category: string | null | undefined): string | null {
  if (!category) return null;
  const trimmed = category.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  return aliasIndex.get(trimmed.toLowerCase()) || trimmed;
}

/** 某个规范分类在数据库中可能出现的所有写法（小写），用于兼容旧数据的查询。 */
export function categoryMatchValues(canonicalEn: string): string[] {
  const cat = CATEGORIES.find((c) => c.en === canonicalEn);
  const values = cat ? [cat.en, cat.cn, ...(cat.aliases || [])] : [canonicalEn];
  return Array.from(new Set(values.map((v) => v.trim().toLowerCase())));
}

export function displayCategoryName(category: string | null | undefined): string {
  if (!category) return '';
  const canonical = normalizeCategory(category);
  return CATEGORIES.find((c) => c.en === canonical)?.cn || category.trim();
}
