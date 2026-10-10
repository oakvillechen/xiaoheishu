require('dotenv').config({ path: '.env' });
const { createClient } = require('@libsql/client');

const APPLY = process.argv.includes('--apply');

async function main() {
  const url = process.env.DATABASE_URL;
  const authToken = process.env.DATABASE_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error('Missing DATABASE_URL or DATABASE_AUTH_TOKEN in .env');
  }

  if (APPLY) {
    // 危险操作保护：真正删除数据前需要显式确认；远程库（非 file:）默认拒绝
    if (String(process.env.CONFIRM_DANGEROUS_DB_SCRIPT || '').trim().toLowerCase() !== 'yes') {
      throw new Error('拒绝 --apply：请设置 CONFIRM_DANGEROUS_DB_SCRIPT=yes 后再运行');
    }
    if (!String(url).startsWith('file:') && process.env.ALLOW_PRODUCTION_DB !== 'yes-i-am-sure') {
      throw new Error('拒绝 --apply：DATABASE_URL 指向远程（生产）数据库，如确需运行请再设置 ALLOW_PRODUCTION_DB=yes-i-am-sure');
    }
  }

  const client = createClient({ url, authToken });

  const whereClause = "images LIKE '%smoke-image-%' OR title = 'Smoke Test Post'";

  const preview = await client.execute(`
    SELECT id, title, images, created_at
    FROM xhs_posts
    WHERE ${whereClause}
    ORDER BY id DESC
  `);

  console.log(`Matched rows: ${preview.rows.length}`);
  console.log(JSON.stringify(preview.rows.slice(0, 30), null, 2));

  if (!APPLY) {
    console.log('Dry run only. Re-run with --apply to delete these rows.');
    return;
  }

  const result = await client.execute(`DELETE FROM xhs_posts WHERE ${whereClause}`);
  console.log(`Deleted rows: ${result.rowsAffected ?? 0}`);

  const remaining = await client.execute(`SELECT count(*) AS c FROM xhs_posts WHERE ${whereClause}`);
  console.log(`Remaining matching rows: ${remaining.rows[0].c}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
