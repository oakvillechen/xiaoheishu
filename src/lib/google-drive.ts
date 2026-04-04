import { google } from 'googleapis';
import { Readable } from 'node:stream';

type ServiceAccount = {
  client_email: string;
  private_key: string;
};

function parseServiceAccountFromEnv(): ServiceAccount {
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!rawKey) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY');
  }

  try {
    const jsonText = Buffer.from(rawKey, 'base64').toString('utf-8');
    const parsed = JSON.parse(jsonText) as ServiceAccount;

    if (!parsed.client_email || !parsed.private_key) {
      throw new Error('Service account JSON is missing required fields');
    }

    return {
      ...parsed,
      private_key: parsed.private_key.replace(/\\n/g, '\n'),
    };
  } catch (error) {
    throw new Error(`Invalid GOOGLE_SERVICE_ACCOUNT_KEY: ${String(error)}`);
  }
}

function createDriveClient() {
  const account = parseServiceAccountFromEnv();
  const auth = new google.auth.JWT({
    email: account.client_email,
    key: account.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return google.drive({ version: 'v3', auth });
}

export function getGoogleDriveImageUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

export function getImageDisplayUrl(value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    return normalized;
  }

  // Keep absolute URLs and local/static paths unchanged.
  if (normalized.startsWith('/') || /^https?:\/\//i.test(normalized)) {
    // Normalize Google Drive share links into direct-view links.
    if (/drive\.google\.com/i.test(normalized)) {
      const fromPath = normalized.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
      if (fromPath?.[1]) {
        return getGoogleDriveImageUrl(fromPath[1]);
      }

      const fromQuery = normalized.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
      if (fromQuery?.[1]) {
        return getGoogleDriveImageUrl(fromQuery[1]);
      }
    }

    return normalized;
  }

  // Fallback: treat as a Google Drive fileId.
  return getGoogleDriveImageUrl(normalized);
}

export async function uploadImageToGoogleDrive(buffer: Buffer, fileName: string, mimeType = 'image/jpeg'): Promise<string> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    throw new Error('Missing GOOGLE_DRIVE_FOLDER_ID');
  }

  const drive = createDriveClient();

  const createdFile = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    supportsAllDrives: true,
    fields: 'id',
  });

  const fileId = createdFile.data.id;
  if (!fileId) {
    throw new Error('Google Drive did not return file id');
  }

  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
    supportsAllDrives: true,
  });

  return fileId;
}
