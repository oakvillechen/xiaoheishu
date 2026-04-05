import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { sql } from 'drizzle-orm';
import path from 'node:path';
import { config } from 'dotenv';

const envConfig = config({ path: path.join(process.cwd(), '.env') }).parsed;
const url = envConfig?.DATABASE_URL || process.env.DATABASE_URL || 'file:local.db';
const authToken = envConfig?.DATABASE_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: npx tsx scripts/promote-admin-by-email.ts <email>');
  process.exit(1);
}

async function main() {
  const client = createClient({ url, authToken });
  const db = drizzle(client);

  const updateResult = await db.run(sql`UPDATE xhs_users SET role = 'admin' WHERE lower(email) = lower(${email})`);
  const checkResult = await db.all(sql`SELECT id, email, role FROM xhs_users WHERE lower(email) = lower(${email})`);

  console.log(JSON.stringify({
    updatedRows: updateResult.rowsAffected ?? 0,
    users: checkResult.rows,
  }, null, 2));
}

main().catch((error) => {
  console.error('Failed to promote admin by email:', error);
  process.exit(1);
});
