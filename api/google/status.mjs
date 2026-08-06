import {
  ensureGoogleCredsLoaded,
  getGoogleStatusAsync,
  GOOGLE_CAL_USER_ID,
  saveGoogleOAuthConfig,
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
  await ensureGoogleCredsLoaded();
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const userId = url.searchParams.get('userId') || GOOGLE_CAL_USER_ID;
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(await getGoogleStatusAsync(userId));
}
