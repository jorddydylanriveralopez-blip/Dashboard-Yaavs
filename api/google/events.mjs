import { createGoogleCalendarEvent } from '../../server/googleCalendarSync.mjs';
import { GOOGLE_CAL_USER_ID, ensureGoogleCredsLoaded } from '../../server/googleCalendarSync.mjs';

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
  const userId = String(req.body?.userId || GOOGLE_CAL_USER_ID);
  try {
    const result = await createGoogleCalendarEvent(userId, {
      title: req.body?.title,
      date: req.body?.date,
      time: req.body?.time,
      estimatedMinutes: req.body?.estimatedMinutes,
      notes: req.body?.notes,
      memberNames: req.body?.memberNames,
      attendeeEmails: req.body?.attendeeEmails,
    });
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
