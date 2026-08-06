import {
  ensureGoogleCredsLoaded,
  GOOGLE_CAL_USER_ID,
  handleGoogleOAuthCallback,
  recordGoogleSyncError,
  syncGoogleCalendar,
} from '../../server/googleCalendarSync.mjs';
import { loadAppState, saveAppState } from '../../server/appStateStore.mjs';

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
    res.status(405).json({ ok: false, error: 'Método no permitido' });
    return;
  }

  await ensureGoogleCredsLoaded();

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const code = body.code;
  const state = body.state || GOOGLE_CAL_USER_ID;
  const redirectHint = body.redirectUri || body.redirect_uri || null;
  if (!code) {
    res.status(400).json({ ok: false, error: 'Falta código OAuth' });
    return;
  }

  try {
    const { userId, email } = await handleGoogleOAuthCallback(
      String(code),
      String(state),
      redirectHint ? String(redirectHint) : undefined,
    );
    let sync = null;
    try {
      sync = await syncGoogleCalendar(loadAppState, saveAppState, userId);
    } catch (syncErr) {
      await recordGoogleSyncError(userId, syncErr);
      console.error('Google sync post-exchange:', syncErr);
    }
    res.status(200).json({
      ok: true,
      userId,
      email,
      eventCount: sync?.eventCount ?? null,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
