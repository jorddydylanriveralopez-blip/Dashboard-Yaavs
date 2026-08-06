import {
  ensureGoogleCredsLoaded,
  GOOGLE_CAL_USER_ID,
  handleGoogleOAuthCallback,
  recordGoogleSyncError,
  syncGoogleCalendar,
} from '../../server/googleCalendarSync.mjs';
import { loadAppState, saveAppState } from '../../server/appStateStore.mjs';

function resultHtml({ ok, message }) {
  const safe = String(message || '').replace(/</g, '&lt;');
  return `<!doctype html><html><body style="font-family:system-ui;padding:2rem;background:#0b1220;color:#e8eefc">
    <h1>${ok ? 'Google Calendar conectado' : 'No se pudo conectar'}</h1>
    <p>${safe}</p>
    <p>Si esta ventana no se cierra sola, vuelve al dashboard → Agenda.</p>
    <script>
      (function () {
        var payload = { type: 'yaavs-google-oauth', ok: ${ok ? 'true' : 'false'} };
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(payload, '*');
            setTimeout(function () { window.close(); }, 600);
            return;
          }
        } catch (e) {}
        try {
          localStorage.setItem('yaavs-google-oauth-result', JSON.stringify(payload));
        } catch (e) {}
        location.replace('/agenda?google=${ok ? 'connected' : 'error'}');
      })();
    </script>
  </body></html>`;
}

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
      resultHtml({ ok: false, message: errorDescription || error }),
    );
    return;
  }
  if (!code) {
    sendHtml(400, resultHtml({ ok: false, message: 'Falta código OAuth' }));
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
      await recordGoogleSyncError(userId, syncErr);
      console.error('Google sync post-callback:', syncErr);
    }
    sendHtml(
      200,
      resultHtml({
        ok: true,
        message: 'Puedes cerrar esta ventana. El dashboard cargará la agenda de Orlando.',
      }),
    );
  } catch (err) {
    sendHtml(
      500,
      resultHtml({
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}
