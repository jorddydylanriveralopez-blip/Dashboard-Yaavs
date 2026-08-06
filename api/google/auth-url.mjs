import {
  ensureGoogleCredsLoaded,
  getGoogleAuthUrl,
  GOOGLE_CAL_USER_ID,
} from '../../server/googleCalendarSync.mjs';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }
  try {
    await ensureGoogleCredsLoaded();
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const userId = url.searchParams.get('userId') || GOOGLE_CAL_USER_ID;
    const ownerName = url.searchParams.get('ownerName') || url.searchParams.get('name') || '';
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '')
      .split(',')[0]
      .trim();
    const proto = String(req.headers['x-forwarded-proto'] || 'https')
      .split(',')[0]
      .trim();
    const redirect = host ? `${proto}://${host}/api/google/callback` : undefined;
    const authUrl = getGoogleAuthUrl(userId, redirect, ownerName);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true, url: authUrl, redirectUri: redirect || undefined });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
