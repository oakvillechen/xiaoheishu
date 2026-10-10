import { NextResponse } from 'next/server';
import { resizeForMobileHighQuality } from '@/lib/image-processing';
import { isCloudinaryConfigured, uploadImageToCloudinary } from '@/lib/cloudinary';
import { authenticateAgentRequest } from '@/lib/agent-auth';
import { isLocalUploadFallbackAllowed } from '@/lib/image-refs';
import { RATE_LIMITS, rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

// POST /api/agent/upload  (multipart/form-data, field "file"; header x-api-key)
export async function POST(request: Request) {
  const auth = authenticateAgentRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const limit = await rateLimit(`agent:${auth.apiKey}`, RATE_LIMITS.agentUpload());
  if (!limit.allowed) {
    return rateLimitResponse(limit);
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
        console.error('Cloudinary upload failed:', err);
      }
    }

    if (!isLocalUploadFallbackAllowed()) {
      return NextResponse.json({ error: 'Image storage unavailable (Cloudinary upload failed or not configured)' }, { status: 503 });
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
