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

  const uid = `smoke-${Date.now()}`;
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

  const authRes = await fetch('http://localhost:3000/api/auth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      userId: uid,
      email: `${uid}@smoke.local`,
      displayName: 'Smoke Tester',
      photoURL: null,
    }),
  });
  const authJson = await authRes.json().catch(() => ({}));

  const createRes = await fetch('http://localhost:3000/api/posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      title: 'Smoke Test Post',
      content: `Smoke test post ${new Date().toISOString()}`,
      userId: uid,
      images: [`smoke-image-${Date.now()}`],
    }),
  });
  const createJson = await createRes.json().catch(() => ({}));
  const createdPostId = Array.isArray(createJson) ? createJson[0]?.id ?? null : createJson?.id ?? null;

  let fetchStatus = null;
  let foundCreatedPost = false;
  if (createRes.ok && createdPostId) {
    const feedRes = await fetch('http://localhost:3000/api/posts?limit=10');
    fetchStatus = feedRes.status;
    const feedJson = await feedRes.json().catch(() => []);
    foundCreatedPost = Array.isArray(feedJson) && feedJson.some((p) => p.id === createdPostId);
  }

  const summary = {
    authStatus: authRes.status,
    authOk: authRes.ok,
    authUserId: authJson?.user?.id || null,
    createStatus: createRes.status,
    createOk: createRes.ok,
    createdPostId,
    fetchStatus,
    foundCreatedPost,
    uid,
  };

  fs.writeFileSync('/tmp/xhs-smoke-result.json', JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error('SMOKE_TEST_ERROR');
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
