import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export class AuthTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthTokenError';
  }
}

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

type FirebaseAdminServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

function parseServiceAccountFromEnv(): FirebaseAdminServiceAccount {
  const rawKey = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!rawKey) {
    throw new Error('Missing FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_KEY');
  }

  try {
    const jsonText = Buffer.from(rawKey, 'base64').toString('utf-8');
    const parsed = JSON.parse(jsonText) as ServiceAccount;

    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      throw new Error('Service account JSON is missing required fields');
    }

    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key.replace(/\\n/g, '\n'),
    };
  } catch (error) {
    throw new Error(`Invalid service account key format: ${String(error)}`);
  }
}

function getFirebaseAdminAuth() {
  if (getApps().length === 0) {
    const serviceAccount = parseServiceAccountFromEnv();
    initializeApp({
      credential: cert(serviceAccount),
    });
  }

  return getAuth();
}

export async function verifyFirebaseTokenFromRequest(request: Request): Promise<string> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthTokenError('Missing Authorization Bearer token');
  }

  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) {
    throw new AuthTokenError('Empty Authorization token');
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    throw new AuthTokenError('Invalid Firebase ID token');
  }
}
