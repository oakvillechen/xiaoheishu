import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { resizeForMobileHighQuality } from '@/lib/image-processing';
import { isCloudinaryConfigured, uploadImageToCloudinary } from '@/lib/cloudinary';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

function secureEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function expectedKeys(): string[] {
  const multi = (process.env.AGENT_PUBLISH_API_KEYS || '').split(',').map((k) => k.trim()).filter(Boolean);
  const single = (process.env.AGENT_PUBLISH_API_KEY || '').trim();
  return single ? [...multi, single] : multi;
}

function providedKey(request: Request): string {
  const x = (request.headers.get('x-api-key') || '').trim();
  if (x) return x;
  const auth = (request.headers.get('authorization') || '').trim();
  return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
}

// POST /api/agent/upload  (multipart/form-data, field "file"; header x-api-key)
export async function POST(request: Request) {
  const keys = expectedKeys();
  if (keys.length === 0) {
    return NextResponse.json({ error: 'Server misconfigured: AGENT_PUBLISH_API_KEYS is missing' }, { status: 500 });
  }
  const key = providedKey(request);
  if (!key || !keys.some((k) => secureEqual(k, key))) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Unsupported image format' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'Image must be 10MB or smaller' }, { status: 400 });
    }

    const resized = await resizeForMobileHighQuality(Buffer.from(await file.arrayBuffer()));
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;

    if (isCloudinaryConfigured()) {
      try {
        const uploaded = await uploadImageToCloudinary(resized, safeName, 'image/jpeg');
        return NextResponse.json({ fileId: uploaded.url, url: uploaded.url, storage: 'cloudinary' });
      } catch (err) {
        console.error('Cloudinary upload failed, using local fallback:', err);
      }
    }

    const dir = path.join(process.cwd(), 'public', 'images', 'uploads');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, safeName), resized);
    const url = `/images/uploads/${safeName}`;
    return NextResponse.json({ fileId: url, url, storage: 'local-fallback' });
  } catch (error) {
    console.error('Agent upload failed:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}
