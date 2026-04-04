const fs = require('fs');
const path = require('path');

async function main() {
  const envPath = path.join(process.cwd(), '.env.local');
  const envRaw = fs.readFileSync(envPath, 'utf8');
  const env = Object.fromEntries(
    envRaw
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const idx = line.indexOf('=');
        return [line.slice(0, idx), line.slice(idx + 1)];
      })
  );

  const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const adminB64 = env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY;
  if (!apiKey || !adminB64) {
    throw new Error('Missing NEXT_PUBLIC_FIREBASE_API_KEY or FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY');
  }

  const serviceAccount = JSON.parse(Buffer.from(adminB64, 'base64').toString('utf8'));
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }

  const uid = `smoke-upload-${Date.now()}`;
  const customToken = await admin.auth().createCustomToken(uid);

  const signInRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const signInJson = await signInRes.json();
  if (!signInRes.ok) {
    throw new Error(`signInWithCustomToken failed: ${signInRes.status} ${JSON.stringify(signInJson)}`);
  }
  const idToken = signInJson.idToken;

  await fetch('http://localhost:3000/api/auth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      userId: uid,
      email: `${uid}@smoke.local`,
      displayName: 'Smoke Uploader',
      photoURL: null,
    }),
  });

  const jpegBuffer = fs.readFileSync('/tmp/xhs-valid.jpg');

  const form = new FormData();
  const file = new File([jpegBuffer], 'tiny.jpg', { type: 'image/jpeg' });
  form.append('file', file);
  form.append('userId', uid);

  const uploadRes = await fetch('http://localhost:3000/api/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    body: form,
  });

  const uploadJson = await uploadRes.json().catch(() => ({}));
  const summary = {
    uid,
    status: uploadRes.status,
    ok: uploadRes.ok,
    response: uploadJson,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
