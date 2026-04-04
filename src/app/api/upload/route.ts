import { NextResponse } from 'next/server';
import { AuthTokenError, verifyFirebaseTokenFromRequest } from '@/lib/firebase-admin';
import { resizeForMobileHighQuality } from '@/lib/image-processing';
import { isCloudinaryConfigured, uploadImageToCloudinary } from '@/lib/cloudinary';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export async function POST(request: Request) {
  try {
    const uid = await verifyFirebaseTokenFromRequest(request);
    const formData = await request.formData();

    const userId = String(formData.get('userId') || '').trim();
    const file = formData.get('file');

    if (!userId || !(file instanceof File)) {
      return NextResponse.json({ error: 'Missing userId or file' }, { status: 400 });
    }

    if (uid !== userId) {
      return NextResponse.json({ error: 'Forbidden userId' }, { status: 403 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Unsupported image format' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'Image must be 10MB or smaller' }, { status: 400 });
    }

    const sourceBuffer = Buffer.from(await file.arrayBuffer());
    const resizedBuffer = await resizeForMobileHighQuality(sourceBuffer);
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;

    if (isCloudinaryConfigured()) {
      try {
        const uploaded = await uploadImageToCloudinary(resizedBuffer, safeName, 'image/jpeg');
        return NextResponse.json({
          // Save direct URL so feed/detail can render without provider-specific parsing.
          fileId: uploaded.url,
          url: uploaded.url,
          storage: 'cloudinary',
        });
      } catch (cloudinaryError) {
        console.error('Cloudinary upload failed, using local fallback:', cloudinaryError);
      }
    }

    const uploadsDir = path.join(process.cwd(), 'public', 'images', 'uploads');
    await mkdir(uploadsDir, { recursive: true });

    const localRelativeUrl = `/images/uploads/${safeName}`;
    const localFilePath = path.join(uploadsDir, safeName);
    await writeFile(localFilePath, resizedBuffer);

    return NextResponse.json({
      fileId: localRelativeUrl,
      url: localRelativeUrl,
      storage: 'local-fallback',
    });
  } catch (error) {
    if (error instanceof AuthTokenError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    console.error('Upload failed:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}
