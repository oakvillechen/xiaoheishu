/**
 * 城市映射表：中文 -> 英文 (规范化)
 */
export const CITY_MAP: Record<string, string> = {
  '多伦多': 'Toronto',
  '温哥华': 'Vancouver',
  '蒙特利尔': 'Montreal',
  '卡尔加里': 'Calgary',
  '渥太华': 'Ottawa',
  '埃德蒙顿': 'Edmonton',
  '密西沙加': 'Mississauga',
  '温尼伯': 'Winnipeg',
  '哈利法克斯': 'Halifax',
  '爱德华王子岛': 'PEI',
  '奥克维尔': 'Oakville',
};

/**
 * 反向城市映射：英文 (规范化) -> 中文
 */
export const REV_CITY_MAP: Record<string, string> = Object.entries(CITY_MAP).reduce(
  (acc, [cn, en]) => ({ ...acc, [en]: cn }),
  {}
);

/**
 * 所有支持的英文城市名列表 (规范化)
 */
export const SUPPORTED_CITIES_EN = Object.values(CITY_MAP);

/**
 * 所有支持的中文城市名列表
 */
export const SUPPORTED_CITIES_CN = Object.keys(CITY_MAP);

/**
 * 规范化城市名称函数
 * @param city 用户输入的城市名称 (中/英文，大小写不限)
 * @returns 规范化的英文城市名称，如 "Toronto"
 */
export function normalizeCityName(city: string | null | undefined): string | null {
  if (!city) return null;
  const trimmed = city.trim();
  if (!trimmed) return null;

  // 1. 直接匹配中文
  if (CITY_MAP[trimmed]) {
    return CITY_MAP[trimmed];
  }

  // 2. 不区分大小写匹配英文
  const lowerInput = trimmed.toLowerCase();
  const canonicalEn = SUPPORTED_CITIES_EN.find(
    (en) => en.toLowerCase() === lowerInput
  );

  if (canonicalEn) {
    return canonicalEn;
  }

  // 3. 特殊处理 (如 PEI)
  if (lowerInput === 'pei' || lowerInput === 'p.e.i.') {
    return 'PEI';
  }

  // 如果都不匹配，保留原样 (首字母大写作为备选)
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}
