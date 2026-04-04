import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../src/db/schema';
import { posts } from '../src/db/schema';
import { like, or } from 'drizzle-orm';
import 'dotenv/config';
import path from 'path';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';

const envConfig = config({ path: path.join(process.cwd(), '.env') }).parsed;
const url = envConfig?.DATABASE_URL || process.env.DATABASE_URL!;
const authToken = envConfig?.DATABASE_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN!;

const client = createClient({ url, authToken });
const db = drizzle(client, { schema });

async function fix() {
  console.log('Fetching all posts with expired xhscdn URLs...');
  
  const badPosts = await db.select().from(posts).where(
    or(
      like(posts.previewImage, '%xhscdn.com%'),
      like(posts.previewImage, '%xiaohongshu.com%')
    )
  );

  console.log(`Found ${badPosts.length} posts with expired URLs. Updating them...`);

  for (const post of badPosts) {
    const city = post.city || 'Canada';
    // Deterministic random image so it doesn't change on every render, mapped to city name
    const newImage = `https://picsum.photos/seed/${encodeURIComponent(post.title || city)}/800/1000`;
    
    await db.update(posts)
      .set({ previewImage: newImage })
      .where(eq(posts.id, post.id));
  }

  console.log('✅ All expired images have been replaced with permanent fallback images.');
}

fix().catch(console.error);
