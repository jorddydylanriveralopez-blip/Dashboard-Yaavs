import {
  recordOutlookIcsError,
  saveOutlookIcsUrl,
  syncOutlookIcsCalendar,
} from '../../server/outlookIcsSync.mjs';
import { loadAppState, saveAppState } from '../../server/appStateStore.mjs';
import { GOOGLE_CAL_USER_ID } from '../../server/googleCalendarSync.mjs';

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
    const userId = String(req.body?.userId || GOOGLE_CAL_USER_ID);
    const status = await saveOutlookIcsUrl(req.body?.url, userId);
    let sync = null;
    try {
      sync = await syncOutlookIcsCalendar(loadAppState, saveAppState, userId);
    } catch (syncErr) {
      await recordOutlookIcsError(syncErr);
    }
    res.status(200).json({
      ok: true,
      ...status,
      eventCount: sync?.eventCount ?? status.eventCount,
      syncedAt: sync?.syncedAt ?? status.lastSyncAt,
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
