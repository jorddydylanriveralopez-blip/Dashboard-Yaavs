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
    const authUrl = getGoogleAuthUrl(userId);
    res.statusCode = 302;
    res.setHeader('Location', authUrl);
    res.end();
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
