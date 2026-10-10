/**
 * 城市定义。数据库里统一存英文规范值（en），界面显示中文（cn）。
 * aliases：历史数据和用户输入中可能出现的其它写法（不区分大小写、忽略首尾空格）。
 * 顺序即显示顺序：大多伦多地区在前，其它加拿大城市在后。
 * featured：首页城市栏高亮显示（Oakville / Burlington / Mississauga / Milton）。
 */
export type CityDef = {
  en: string;
  cn: string;
  aliases?: string[];
  featured?: boolean;
};

export const CITIES: CityDef[] = [
  // 大多伦多地区（GTA）优先
  { en: 'Toronto', cn: '多伦多', aliases: ['多市', '多伦多市', 'TO'] },
  { en: 'Oakville', cn: '奥克维尔', aliases: ['奥克维', '奥村'], featured: true },
  { en: 'Burlington', cn: '伯灵顿', aliases: ['柏林顿', '伯林顿'], featured: true },
  { en: 'Mississauga', cn: '密西沙加', aliases: ['密市', '密西沙加市'], featured: true },
  { en: 'Milton', cn: '米尔顿', aliases: ['米尔顿市'], featured: true },
  { en: 'Markham', cn: '万锦', aliases: ['万锦市', '马卡姆'] },
  { en: 'Richmond Hill', cn: '列治文山', aliases: ['烈治文山', 'RichmondHill', '列治文山市'] },
  { en: 'North York', cn: '北约克', aliases: ['NorthYork', '北约'] },
  { en: 'Scarborough', cn: '士嘉堡', aliases: ['士嘉堡市', '世嘉堡'] },
  { en: 'Vaughan', cn: '旺市', aliases: ['沃恩'] },
  { en: 'Brampton', cn: '宾顿', aliases: ['布兰普顿', '宾顿市'] },
  { en: 'Hamilton', cn: '哈密尔顿', aliases: ['汉密尔顿', '咸美顿'] },
  // 其它加拿大城市
  { en: 'Waterloo', cn: '滑铁卢', aliases: ['滑铁卢市', 'KW', 'Kitchener-Waterloo'] },
  { en: 'Ottawa', cn: '渥太华' },
  { en: 'Montreal', cn: '蒙特利尔', aliases: ['Montréal', '满地可', '蒙城'] },
  { en: 'Vancouver', cn: '温哥华', aliases: ['温市', '大温', '大温哥华'] },
  { en: 'Calgary', cn: '卡尔加里', aliases: ['卡城'] },
  { en: 'Edmonton', cn: '埃德蒙顿', aliases: ['爱民顿', '埃德蒙顿市'] },
  { en: 'Winnipeg', cn: '温尼伯', aliases: ['温尼伯市'] },
  { en: 'Halifax', cn: '哈利法克斯', aliases: ['哈法'] },
  { en: 'PEI', cn: '爱德华王子岛', aliases: ['P.E.I.', 'Prince Edward Island', '爱岛'] },
];

const aliasIndex: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const city of CITIES) {
    for (const value of [city.en, city.cn, ...(city.aliases || [])]) {
      map.set(value.trim().toLowerCase(), city.en);
    }
  }
  return map;
})();

/** 城市映射表：中文 -> 英文（兼容旧代码） */
export const CITY_MAP: Record<string, string> = Object.fromEntries(CITIES.map((c) => [c.cn, c.en]));

/** 反向映射：英文 -> 中文 */
export const REV_CITY_MAP: Record<string, string> = Object.fromEntries(CITIES.map((c) => [c.en, c.cn]));

/** 所有支持的英文城市名（按显示顺序） */
export const SUPPORTED_CITIES_EN = CITIES.map((c) => c.en);

/** 所有支持的中文城市名（按显示顺序） */
export const SUPPORTED_CITIES_CN = CITIES.map((c) => c.cn);

/** 首页重点城市 */
export const FEATURED_CITIES = CITIES.filter((c) => c.featured);

/**
 * 规范化城市名称
 * @returns 已知城市返回英文规范名（如 "Toronto"）；未知城市保留原文（首字母大写）；空值返回 null
 */
export function normalizeCityName(city: string | null | undefined): string | null {
  if (!city) return null;
  const trimmed = city.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;

  const known = aliasIndex.get(trimmed.toLowerCase());
  if (known) return known;

  // 未知城市：英文首字母大写，其它保留（如 "St. Thomas"）
  return /^[a-z]/.test(trimmed) ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : trimmed;
}

/** 某个规范城市在数据库中可能出现的所有写法（小写），用于兼容旧数据的查询。 */
export function cityMatchValues(canonicalEn: string): string[] {
  const city = CITIES.find((c) => c.en === canonicalEn);
  const values = city ? [city.en, city.cn, ...(city.aliases || [])] : [canonicalEn];
  return Array.from(new Set(values.map((v) => v.trim().toLowerCase())));
}

/** 界面显示用：已知城市显示中文，否则原样显示。 */
export function displayCityName(city: string | null | undefined): string {
  if (!city) return '';
  const canonical = normalizeCityName(city);
  return (canonical && REV_CITY_MAP[canonical]) || city.trim();
}
