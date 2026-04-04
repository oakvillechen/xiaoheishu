import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from '@/db/schema';
import path from 'path';
import { config } from 'dotenv';
const envConfig = config({ path: path.join(process.cwd(), '.env') }).parsed;
const url = envConfig?.DATABASE_URL || process.env.DATABASE_URL || 'file:local.db';
const authToken = envConfig?.DATABASE_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;

const client = createClient({
  url: url,
  authToken: authToken,
});

export const db = drizzle(client, { schema });
