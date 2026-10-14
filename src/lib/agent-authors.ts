/**
 * 绑定了作者的 Agent Key 可以额外使用的轮换笔名（生活类帖子）。
 * 只允许列表内的名字，防止冒名；可用环境变量 AGENT_PUBLISH_AUTHOR_ALLOWLIST（逗号分隔）追加。
 */
export const AGENT_AUTHOR_ALLOWLIST: readonly string[] = [
  '多村散步的猫',
  '北约克吃货阿May',
  '万锦周末爸爸',
  '密市新移民小白',
  '士嘉堡早茶党',
  '湖边跑步的Leo',
  '列治文山种菜人',
  'Downtown打工人小周',
  '奥克维尔滑雪迷',
  '宾顿带娃日记',
];

export function isAllowedAgentAuthor(name: string | null | undefined): boolean {
  const n = String(name || '').trim();
  if (!n) return false;
  const extra = String(process.env.AGENT_PUBLISH_AUTHOR_ALLOWLIST || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return AGENT_AUTHOR_ALLOWLIST.includes(n) || extra.includes(n);
}
