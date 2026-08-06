import { saveGoogleOAuthConfig } from '../../server/googleCalendarSync.mjs';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  try {
    const body = req.body ?? {};
    const saved = await saveGoogleOAuthConfig({
      clientId: body.clientId || body.GOOGLE_CLIENT_ID,
      clientSecret: body.clientSecret || body.GOOGLE_CLIENT_SECRET,
      redirectUri: body.redirectUri || body.GOOGLE_REDIRECT_URI,
    });
    res.status(200).json({
      ok: true,
      configured: true,
      redirectUri: saved.redirectUri,
      clientId: saved.clientId,
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
