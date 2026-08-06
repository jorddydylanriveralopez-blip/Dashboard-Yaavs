import {
  ensureGoogleCredsLoaded,
  GOOGLE_CAL_USER_ID,
  handleGoogleOAuthCallback,
  recordGoogleSyncError,
  syncGoogleCalendar,
} from '../../server/googleCalendarSync.mjs';
import { loadAppState, saveAppState } from '../../server/appStateStore.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).send('Método no permitido');
    return;
  }

  await ensureGoogleCredsLoaded();

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  const sendHtml = (status, html) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(html);
  };

  if (error) {
    sendHtml(
      400,
      `<html><body><h1>No se pudo conectar Google Calendar</h1><p>${errorDescription || error}</p></body></html>`,
    );
    return;
  }
  if (!code) {
    sendHtml(400, '<html><body><h1>Falta código OAuth</h1></body></html>');
    return;
  }

  try {
    const { userId } = await handleGoogleOAuthCallback(
      String(code),
      state ? String(state) : GOOGLE_CAL_USER_ID,
    );
    try {
      await syncGoogleCalendar(loadAppState, saveAppState, userId);
    } catch (syncErr) {
      recordGoogleSyncError(userId, syncErr);
      console.error('Google sync post-callback:', syncErr);
    }
    sendHtml(
      200,
      `<html><body style="font-family:system-ui;padding:2rem">
        <h1>Google Calendar conectado</h1>
        <p>Ya puedes cerrar esta ventana y volver al dashboard.</p>
        <script>setTimeout(function(){ window.close(); }, 1500);</script>
      </body></html>`,
    );
  } catch (err) {
    sendHtml(
      500,
      `<html><body><h1>Error OAuth</h1><p>${err instanceof Error ? err.message : String(err)}</p></body></html>`,
    );
  }
}
