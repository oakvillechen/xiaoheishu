import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../src/db/schema';
import { users, posts, comments } from '../src/db/schema';
import 'dotenv/config';
import path from 'path';
import { config } from 'dotenv';

const envConfig = config({ path: path.join(process.cwd(), '.env') }).parsed;
const url = envConfig?.DATABASE_URL || process.env.DATABASE_URL!;
const authToken = envConfig?.DATABASE_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN!;

const client = createClient({ url, authToken });
const db = drizzle(client, { schema });

async function nuke() {
  console.log('Force Nuking all data...');
  await db.delete(comments);
  await db.delete(posts);
  await db.delete(users);
  console.log('Done.');
}

nuke().catch(console.error);
