/**
 * 把 xhs_posts 里的 city / category 规范成英文标准值（如 多伦多 → Toronto，生活 → Life）。
 *
 * 默认 dry-run（只读，打印将要修改的统计，不写库）：
 *   npx tsx scripts/normalize-cities-categories.ts
 *
 * 真正写入（受危险脚本保护）：
 *   CONFIRM_DANGEROUS_DB_SCRIPT=yes npx tsx scripts/normalize-cities-categories.ts --apply
 *   # 对远程（生产）Turso 库还需要：ALLOW_PRODUCTION_DB=yes-i-am-sure
 *
 * 读取 .env 或环境变量里的 DATABASE_URL / DATABASE_AUTH_TOKEN。
 */
import { createClient } from '@libsql/client';
import path from 'node:path';
import { config } from 'dotenv';
import { normalizeCityName } from '../src/lib/constants/cities';
import { normalizeCategory } from '../src/lib/constants/categories';
import { assertDangerousScriptAllowed } from '../src/lib/db-script-guard';

const APPLY = process.argv.includes('--apply');

const envConfig = config({ path: path.join(process.cwd(), '.env'), quiet: true }).parsed;
const url = envConfig?.DATABASE_URL || process.env.DATABASE_URL || 'file:local.db';
const authToken = envConfig?.DATABASE_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;

type Change = { id: number; field: 'city' | 'category'; from: string | null; to: string | null };

function countBy(changes: Change[], field: 'city' | 'category') {
  const map = new Map<string, number>();
  for (const c of changes.filter((x) => x.field === field)) {
    const key = `${JSON.stringify(c.from)} → ${JSON.stringify(c.to)}`;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

async function main() {
  if (APPLY) {
    assertDangerousScriptAllowed('normalize-cities-categories', url);
  }

  const client = createClient({ url, authToken });
  const result = await client.execute('SELECT id, city, category FROM xhs_posts');
  const changes: Change[] = [];

  for (const row of result.rows) {
    const id = Number(row.id);
    const city = row.city === null ? null : String(row.city);
    const category = row.category === null ? null : String(row.category);

    const nextCity = normalizeCityName(city);
    const nextCategory = normalizeCategory(category);

    // 空字符串 / 纯空格 统一成 NULL；值相同则不动
    if (city !== nextCity) {
      changes.push({ id, field: 'city', from: city, to: nextCity });
    }
    if (category !== nextCategory) {
      changes.push({ id, field: 'category', from: category, to: nextCategory });
    }
  }

  const host = url.startsWith('file:') ? url : (() => { try { return new URL(url).host; } catch { return url; } })();
  console.log(`数据库：${host}`);
  console.log(`帖子总数：${result.rows.length}`);
  console.log(`需要修改：city ${changes.filter((c) => c.field === 'city').length} 条，category ${changes.filter((c) => c.field === 'category').length} 条\n`);

  for (const field of ['city', 'category'] as const) {
    const rows = countBy(changes, field);
    if (rows.length === 0) continue;
    console.log(`[${field}]`);
    for (const [key, n] of rows) console.log(`  ${key}  ×${n}`);
    console.log('');
  }

  if (!APPLY) {
    console.log('Dry run：未写入任何数据。确认无误后加 --apply（并设置 CONFIRM_DANGEROUS_DB_SCRIPT=yes）执行。');
    return;
  }

  if (changes.length === 0) {
    console.log('没有需要修改的数据。');
    return;
  }

  const statements = changes.map((c) => ({
    sql: c.field === 'city' ? 'UPDATE xhs_posts SET city = ? WHERE id = ?' : 'UPDATE xhs_posts SET category = ? WHERE id = ?',
    args: [c.to, c.id],
  }));
  await client.batch(statements, 'write');
  console.log(`✅ 已更新 ${changes.length} 处字段。`);
}

main().catch((error) => {
  console.error('normalize-cities-categories failed:', error);
  process.exit(1);
});
