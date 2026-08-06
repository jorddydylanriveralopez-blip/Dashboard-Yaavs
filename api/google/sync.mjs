import {
  ensureGoogleCredsLoaded,
  GOOGLE_CAL_USER_ID,
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
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  await ensureGoogleCredsLoaded();

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const userId = String(
    req.body?.userId || url.searchParams.get('userId') || GOOGLE_CAL_USER_ID,
  );

  try {
    const result = await syncGoogleCalendar(loadAppState, saveAppState, userId);
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    recordGoogleSyncError(userId, error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
