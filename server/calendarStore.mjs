import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// import.meta.url puede romperse al empaquetar (Netlify/esbuild). En serverless
// se usa Blob, así que el directorio local se protege con fallback nulo.
let LOCAL_DIR = null;
try {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  LOCAL_DIR = path.join(__dirname, 'data', 'calendars');
} catch {
  LOCAL_DIR = null;
}

function localPath(userId) {
  return LOCAL_DIR ? path.join(LOCAL_DIR, `${userId}.json`) : null;
}

async function saveToBlob(userId, payload) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return false;

  const { put } = await import('@vercel/blob');
  await put(`calendars/${userId}.json`, JSON.stringify(payload), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    token,
  });
  return true;
}

async function loadFromBlob(userId) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;

  const { list } = await import('@vercel/blob');
  const { blobs } = await list({ prefix: `calendars/${userId}.json`, token });
  const match = blobs.find((b) => b.pathname === `calendars/${userId}.json`);
  if (!match?.url) return null;

  const res = await fetch(match.url, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

export async function saveUserCalendar(userId, payload) {
  const data = {
    ...payload,
    userId,
    updatedAt: new Date().toISOString(),
  };

  if (await saveToBlob(userId, data)) return data;

  if (LOCAL_DIR) {
    fs.mkdirSync(LOCAL_DIR, { recursive: true });
    fs.writeFileSync(localPath(userId), JSON.stringify(data, null, 2));
  }
  return data;
}

export async function loadUserCalendar(userId) {
  const fromBlob = await loadFromBlob(userId);
  if (fromBlob) return fromBlob;

  try {
    const lp = localPath(userId);
    if (lp && fs.existsSync(lp)) {
      return JSON.parse(fs.readFileSync(lp, 'utf8'));
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function listTrackedUserIds() {
  const ids = new Set();

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { list } = await import('@vercel/blob');
      const { blobs } = await list({ prefix: 'calendars/', token: process.env.BLOB_READ_WRITE_TOKEN });
      for (const blob of blobs) {
        const match = blob.pathname.match(/^calendars\/(.+)\.json$/);
        if (match) ids.add(match[1]);
      }
    } catch {
      /* ignore */
    }
  }

  try {
    if (LOCAL_DIR && fs.existsSync(LOCAL_DIR)) {
      for (const file of fs.readdirSync(LOCAL_DIR)) {
        if (file.endsWith('.json')) ids.add(file.replace(/\.json$/, ''));
      }
    }
  } catch {
    /* ignore */
  }

  return [...ids];
}
