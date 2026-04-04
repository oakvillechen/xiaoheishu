const fs = require('fs');
const { google } = require('googleapis');

function readEnvFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/).filter((line) => line && line.includes('=') && !line.startsWith('#'));
  return Object.fromEntries(
    lines.map((line) => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx), line.slice(idx + 1)];
    })
  );
}

async function main() {
  const env = readEnvFile('.env.local');
  const rawKey = env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const folderId = env.GOOGLE_DRIVE_FOLDER_ID;

  if (!rawKey || !folderId) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_DRIVE_FOLDER_ID in .env.local');
  }

  const account = JSON.parse(Buffer.from(rawKey, 'base64').toString('utf8'));

  const auth = new google.auth.JWT({
    email: account.client_email,
    key: account.private_key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const drive = google.drive({ version: 'v3', auth });

  const fileMeta = await drive.files.get({
    fileId: folderId,
    supportsAllDrives: true,
    fields: 'id,name,mimeType,driveId,ownedByMe,parents,capabilities(canAddChildren,canEdit),permissions(id,emailAddress,role,type)',
  });

  console.log('Service Account:', account.client_email);
  console.log(JSON.stringify(fileMeta.data, null, 2));
}

main().catch((error) => {
  console.error(error?.message || String(error));
  if (error?.response?.data) {
    console.error(JSON.stringify(error.response.data, null, 2));
  }
  process.exit(1);
});
