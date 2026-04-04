import { createClient } from '@libsql/client';
import fs from 'fs';
import 'dotenv/config';

const client = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN!,
});

async function main() {
  try {
    const sqlFile = 'drizzle/0000_ancient_dazzler.sql';
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    const statements = sql
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    console.log(`Applying ${statements.length} migration statements...`);
    for (const stmt of statements) {
      await client.execute(stmt);
    }
    console.log('Migration applied successfully.');
  } catch (e) {
    console.error('Migration failed:', e);
  }
}

main();
