import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getGaReport } from './gaReport.mjs';
import { saveUserCalendar, loadUserCalendar } from './calendarStore.mjs';
import {
  listLibraryImages,
  addLibraryImage,
  removeLibraryImage,
  readLocalLibraryFile,
} from './mediaLibraryStore.mjs';
import { buildMediaCatalog, enrichLibraryItem, resolveLibraryImageUrl } from './mediaApiFormat.mjs';
import { emptyAppState, loadAppState, saveAppState } from './appStateStore.mjs';
import { readEvidenceFile } from './evidenceStore.mjs';
import {
  resolveReminderEmail,
  sendCalendarReminderEmail,
  sendAgendaAlertEmail,
  eventsDueForReminder,
} from './calendarReminders.mjs';
import { removeSubscription, saveSubscription, sendPush } from './pushStore.mjs';
import {
  ensureGoogleCredsLoaded,
  getGoogleAuthUrl,
  getGoogleStatusAsync,
  googleConfigured,
  GOOGLE_CAL_USER_ID,
  handleGoogleOAuthCallback,
  listConnectedGoogleUserIds,
  recordGoogleSyncError,
  saveGoogleOAuthConfig,
  syncAllGoogleCalendars,
  syncGoogleCalendar,
} from './googleCalendarSync.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(__dirname, 'data', 'store.json');
const DIST_DIR = path.join(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT) || 3001;

function loadDotEnv() {
  try {
    const envPath = path.join(ROOT, '.env');
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

loadDotEnv();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'yaavs-board', google: googleConfigured() });
});

app.get('/api/evidence/:filename', (req, res) => {
  const file = readEvidenceFile(req.params.filename);
  if (!file) {
    res.status(404).json({ error: 'Evidencia no encontrada' });
    return;
  }
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(file.filename)}"`,
  );
  res.send(file.buffer);
});

app.get('/api/state', async (_req, res) => {
  try {
    res.json(await loadAppState());
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'No se pudo leer el estado',
    });
  }
});

app.put('/api/state', async (req, res) => {
  const body = req.body;
  if (!body?.board) {
    res.status(400).json({ error: 'Estado inválido' });
    return;
  }
  try {
    const saved = await saveAppState(body);
    res.json({ ok: true, updatedAt: saved.updatedAt });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'No se pudo guardar el estado',
    });
  }
});

app.get('/api/google/status', async (req, res) => {
  await ensureGoogleCredsLoaded();
  const userId = String(req.query.userId || GOOGLE_CAL_USER_ID);
  res.json(await getGoogleStatusAsync(userId));
});

app.post('/api/google/configure', async (req, res) => {
  try {
    const saved = await saveGoogleOAuthConfig({
      clientId: req.body?.clientId || req.body?.GOOGLE_CLIENT_ID,
      clientSecret: req.body?.clientSecret || req.body?.GOOGLE_CLIENT_SECRET,
      redirectUri: req.body?.redirectUri || req.body?.GOOGLE_REDIRECT_URI,
    });
    res.json({
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
});

app.get('/api/google/auth', async (req, res) => {
  try {
    await ensureGoogleCredsLoaded();
    const userId = String(req.query.userId || GOOGLE_CAL_USER_ID);
    res.redirect(getGoogleAuthUrl(userId));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get('/api/google/auth-url', async (req, res) => {
  try {
    await ensureGoogleCredsLoaded();
    const userId = String(req.query.userId || GOOGLE_CAL_USER_ID);
    const ownerName = String(req.query.ownerName || req.query.name || '').trim();
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    const proto = String(
      req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'https'),
    )
      .split(',')[0]
      .trim();
    const redirect =
      host
        ? `${proto}://${host}/api/google/callback`
        : undefined;
    res.json({
      ok: true,
      url: getGoogleAuthUrl(userId, redirect, ownerName),
      redirectUri: redirect || undefined,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

function googleOAuthResultHtml({ ok, message }) {
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

app.get('/api/google/callback', async (req, res) => {
  await ensureGoogleCredsLoaded();
  const { code, state, error, error_description: errorDescription } = req.query;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (error) {
    res
      .status(400)
      .send(
        googleOAuthResultHtml({
          ok: false,
          message: String(errorDescription || error),
        }),
      );
    return;
  }
  if (!code) {
    res
      .status(400)
      .send(googleOAuthResultHtml({ ok: false, message: 'Falta código OAuth' }));
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
    res.send(
      googleOAuthResultHtml({
        ok: true,
        message: 'Puedes cerrar esta ventana. El dashboard cargará la agenda de Orlando.',
      }),
    );
  } catch (err) {
    res.status(500).send(
      googleOAuthResultHtml({
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      }),
    );
  }
});

app.post('/api/google/exchange', async (req, res) => {
  await ensureGoogleCredsLoaded();
  const code = req.body?.code || req.query.code;
  const state = req.body?.state || req.query.state || GOOGLE_CAL_USER_ID;
  const redirectHint = req.body?.redirectUri || req.body?.redirect_uri || null;
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
    res.json({
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
});

app.post('/api/google/sync', async (req, res) => {
  await ensureGoogleCredsLoaded();
  const userId = String(req.body?.userId || req.query.userId || GOOGLE_CAL_USER_ID);
  try {
    const result = await syncGoogleCalendar(loadAppState, saveAppState, userId);
    res.json({ ok: true, ...result });
  } catch (error) {
    recordGoogleSyncError(userId, error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get('/api/analytics/report', async (req, res) => {
  const monthKey =
    typeof req.query.month === 'string'
      ? req.query.month
      : new Date().toISOString().slice(0, 7);
  try {
    const report = await getGaReport(monthKey);
    res.json(report);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Error al consultar Google Analytics',
    });
  }
});

app.post('/api/calendar/sync', async (req, res) => {
  const { userId, userName, email, events } = req.body ?? {};
  if (!userId || !Array.isArray(events)) {
    res.status(400).json({ error: 'Estado de agenda inválido' });
    return;
  }
  try {
    const saved = await saveUserCalendar(userId, {
      userName: userName ?? '',
      email: email ?? '',
      events,
    });
    res.json({ ok: true, updatedAt: saved.updatedAt });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'No se pudo guardar la agenda',
    });
  }
});

app.post('/api/calendar/send-reminder', async (req, res) => {
  const { userId, userName, email, event } = req.body ?? {};
  if (!userId || !event?.id || !event?.title) {
    res.status(400).json({ error: 'Datos incompletos' });
    return;
  }
  const to = resolveReminderEmail(userId, email);
  if (!to) {
    res.status(400).json({ error: 'Sin correo configurado para recordatorios' });
    return;
  }
  const result = await sendCalendarReminderEmail({
    to,
    userName: userName ?? 'Usuario',
    event,
  });
  if (!result.ok) {
    res.status(500).json({ error: result.error ?? 'No se pudo enviar el correo' });
    return;
  }
  res.json({ ok: true, to });
});

/** Aviso inmediato a Orlando (u otro destinatario) por cambios de agenda del equipo. */
app.post('/api/calendar/send-alert', async (req, res) => {
  const { toUserId, email, actorName, title, body, date, time } = req.body ?? {};
  if (!title || !body) {
    res.status(400).json({ error: 'Datos incompletos' });
    return;
  }
  const to = resolveReminderEmail(toUserId || 'u-orlando', email);
  if (!to) {
    res.status(400).json({ error: 'Sin correo configurado para avisos' });
    return;
  }
  const result = await sendAgendaAlertEmail({
    to,
    actorName: actorName ?? 'Equipo',
    title,
    body,
    date,
    time,
  });
  if (!result.ok) {
    res.status(500).json({ error: result.error ?? 'No se pudo enviar el aviso' });
    return;
  }
  res.json({ ok: true, to });
});

async function processCalendarReminders(_req, res) {
  const sent = [];
  const errors = [];
  try {
    const userIds = ['u-orlando'];
    for (const userId of userIds) {
      const store = await loadUserCalendar(userId);
      if (!store?.events?.length) continue;

      const email = resolveReminderEmail(userId, store.email);
      if (!email) continue;

      const due = eventsDueForReminder(store.events);
      if (due.length === 0) continue;

      let changed = false;
      for (const event of due) {
        const result = await sendCalendarReminderEmail({
          to: email,
          userName: store.userName ?? 'Orlando',
          event,
        });
        if (result.ok) {
          event.emailRemindedAt = new Date().toISOString();
          sent.push({ userId, eventId: event.id, title: event.title });
          changed = true;
        } else {
          errors.push({ userId, eventId: event.id, error: result.error });
        }
      }

      if (changed) {
        await saveUserCalendar(userId, store);
      }
    }
    res.json({ ok: true, sent, errors });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Error procesando recordatorios',
    });
  }
}

app.get('/api/calendar/process-reminders', processCalendarReminders);
app.post('/api/calendar/process-reminders', processCalendarReminders);

const MAX_LIBRARY_BYTES = 8 * 1024 * 1024;

function requestOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] ?? req.protocol ?? 'http';
  const host = req.headers['x-forwarded-host'] ?? req.get('host');
  if (!host) return `http://localhost:${PORT}`;
  return `${proto}://${host}`;
}

app.get('/api/media/list', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const items = await listLibraryImages();
    const catalog = buildMediaCatalog(items, requestOrigin(req));
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60');
    res.json(catalog);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'No se pudo cargar la biblioteca',
    });
  }
});

app.get('/api/media/item', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) {
    res.status(400).json({ error: 'Falta el parámetro id' });
    return;
  }
  try {
    const items = await listLibraryImages();
    const item = items.find((i) => i.id === id);
    if (!item) {
      res.status(404).json({ error: 'Imagen no encontrada' });
      return;
    }
    const origin = requestOrigin(req);
    const resolved = { ...item, url: resolveLibraryImageUrl(item.url, origin) };
    res.json(enrichLibraryItem(resolved, origin));
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'No se pudo cargar la imagen',
    });
  }
});

app.get('/api/media/download', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) {
    res.status(400).json({ error: 'Falta el parámetro id' });
    return;
  }
  try {
    const items = await listLibraryImages();
    const item = items.find((i) => i.id === id);
    if (!item) {
      res.status(404).json({ error: 'Imagen no encontrada' });
      return;
    }
    const origin = requestOrigin(req);
    const url = resolveLibraryImageUrl(item.url, origin);
    const fileRes = await fetch(url, { cache: 'no-store' });
    if (!fileRes.ok) {
      res.status(502).json({ error: 'No se pudo obtener el archivo' });
      return;
    }
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const safeName = item.name.replace(/[^\w.\-() ]+/g, '_') || `imagen-${item.id}`;
    res.setHeader('Content-Type', item.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'No se pudo descargar la imagen',
    });
  }
});

app.post('/api/media/upload', async (req, res) => {
  const { id, name, mimeType, size, base64, uploadedBy, uploadedByName, width, height } = req.body ?? {};
  if (!id || !name || !mimeType || !base64 || !uploadedBy) {
    res.status(400).json({ error: 'Datos de imagen incompletos' });
    return;
  }
  if (!mimeType.startsWith('image/')) {
    res.status(400).json({ error: 'Solo se permiten imágenes' });
    return;
  }
  try {
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length > MAX_LIBRARY_BYTES) {
      res.status(400).json({ error: 'La imagen no puede superar 8 MB' });
      return;
    }
    const item = {
      id,
      name,
      mimeType,
      size: size ?? buffer.length,
      uploadedBy,
      uploadedByName: uploadedByName ?? uploadedBy,
      uploadedAt: new Date().toISOString(),
      width: width ?? null,
      height: height ?? null,
    };
    const saved = await addLibraryImage(item, buffer);
    res.json({ ok: true, item: saved });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'No se pudo subir la imagen',
    });
  }
});

app.post('/api/media/delete', async (req, res) => {
  const { id } = req.body ?? {};
  if (!id) {
    res.status(400).json({ error: 'Falta el id de la imagen' });
    return;
  }
  try {
    const ok = await removeLibraryImage(id);
    if (!ok) {
      res.status(404).json({ error: 'Imagen no encontrada' });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'No se pudo eliminar la imagen',
    });
  }
});

app.get('/api/media/file/:id', (req, res) => {
  const file = readLocalLibraryFile(req.params.id);
  if (!file) {
    res.status(404).json({ error: 'Archivo no encontrado' });
    return;
  }
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(file.buffer);
});

app.all('/api/push', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }
  const body = req.body ?? {};
  const action = body.action;
  try {
    if (action === 'subscribe') {
      const { subscription, userId, userName, employeeId } = body;
      if (!subscription?.endpoint) {
        res.status(400).json({ error: 'Suscripción inválida' });
        return;
      }
      await saveSubscription({ subscription, userId, userName, employeeId });
      res.status(200).json({ ok: true });
      return;
    }
    if (action === 'unsubscribe') {
      await removeSubscription(body.endpoint);
      res.status(200).json({ ok: true });
      return;
    }
    if (action === 'notify') {
      const { audience, employeeIds, userIds, excludeUserId, title, body: text, url, tag } = body;
      if (!title) {
        res.status(400).json({ error: 'Falta el título' });
        return;
      }
      const result = await sendPush({
        audience,
        employeeIds,
        userIds,
        excludeUserId,
        title,
        body: text,
        url,
        tag,
      });
      res.status(200).json(result);
      return;
    }
    res.status(400).json({ error: 'Acción desconocida' });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
  }
});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

const HAS_REMOTE_DB = Boolean(
  process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL,
);

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Yaavs API en el puerto ${PORT}`);
  // Nunca crear un tablero vacío en producción (Hostinger/Render/Fly):
  // eso borraría la sincronización si aún no está DATABASE_URL.
  // Solo sembramos archivo local en desarrollo.
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd && !HAS_REMOTE_DB && !fs.existsSync(DB_PATH)) {
    try {
      await saveAppState(emptyAppState());
      console.log('Base de datos inicial creada en server/data/store.json');
    } catch (error) {
      console.error('No se pudo crear la base local:', error?.message ?? error);
    }
  }
  if (isProd && !HAS_REMOTE_DB) {
    console.warn(
      'DATABASE_URL no está configurada. Configúrala en Hostinger/Render con la misma Neon para no perder proyectos.',
    );
  }
  if (googleConfigured() || (await ensureGoogleCredsLoaded())) {
    console.log('Google Calendar OAuth configurado');
    const tick = async () => {
      await ensureGoogleCredsLoaded();
      const userIds = await listConnectedGoogleUserIds();
      if (!userIds.length) return;
      try {
        await syncAllGoogleCalendars(loadAppState, saveAppState);
      } catch (err) {
        console.error('Google sync periódico:', err?.message ?? err);
      }
    };
    void tick();
    setInterval(tick, 5 * 60 * 1000);
  } else {
    console.log('Google Calendar no configurado (GOOGLE_CLIENT_ID / SECRET / REDIRECT_URI)');
  }
});
