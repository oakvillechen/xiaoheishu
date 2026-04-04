import { createHash } from 'node:crypto';

type CloudinaryUploadResult = {
  fileId: string;
  url: string;
};

function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  const folder = process.env.CLOUDINARY_FOLDER?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }

  return {
    cloudName,
    apiKey,
    apiSecret,
    folder: folder || undefined,
  };
}

export function isCloudinaryConfigured(): boolean {
  return getCloudinaryConfig() !== null;
}

export async function uploadImageToCloudinary(
  buffer: Buffer,
  fileName: string,
  mimeType = 'image/jpeg'
): Promise<CloudinaryUploadResult> {
  const config = getCloudinaryConfig();
  if (!config) {
    throw new Error('Missing Cloudinary config');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signedParams: Record<string, string | number> = {
    timestamp,
  };

  if (config.folder) {
    signedParams.folder = config.folder;
  }

  const toSign = Object.keys(signedParams)
    .sort()
    .map((key) => `${key}=${signedParams[key]}`)
    .join('&');

  const signature = createHash('sha1')
    .update(`${toSign}${config.apiSecret}`)
    .digest('hex');

  const form = new FormData();
  const binary = new Uint8Array(buffer);
  form.append('file', new Blob([binary], { type: mimeType }), fileName);
  form.append('api_key', config.apiKey);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);

  if (config.folder) {
    form.append('folder', config.folder);
  }

  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });

  const data = await response.json().catch(() => ({} as Record<string, unknown>));

  if (!response.ok) {
    const message =
      typeof data?.error === 'object' && data?.error && 'message' in data.error
        ? String((data.error as { message?: unknown }).message)
        : `HTTP ${response.status}`;
    throw new Error(`Cloudinary upload failed: ${message}`);
  }

  const secureUrl = typeof data.secure_url === 'string' ? data.secure_url : '';
  const publicId = typeof data.public_id === 'string' ? data.public_id : '';

  if (!secureUrl) {
    throw new Error('Cloudinary upload missing secure_url');
  }

  return {
    fileId: publicId || secureUrl,
    url: secureUrl,
  };
}
