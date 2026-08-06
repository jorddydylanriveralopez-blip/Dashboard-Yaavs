import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const TOKENS_PATH = path.join(DATA_DIR, 'google-tokens.json');
const OAUTH_FILE = path.join(DATA_DIR, 'google-oauth.json');
const OAUTH_DB_KEY = 'yaavs-google-oauth';
const TOKENS_DB_KEY = 'yaavs-google-tokens';

export const GOOGLE_CAL_USER_ID = 'u-orlando';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');
/** ~2 años hacia atrás para no perder conciertos / eventos viejos. */
const SYNC_LOOKBACK_DAYS = 730;
/** ~1 año hacia adelante (antes 4 meses; se cortaban muchos días). */
const SYNC_LOOKAHEAD_DAYS = 365;

let credsLoadPromise = null;
let tokensMemory = null;
let tokensLoadPromise = null;

function env(name, fallback = '') {
  return (process.env[name] ?? fallback).trim();
}

function applyCreds(cfg = {}) {
  if (cfg.clientId) process.env.GOOGLE_CLIENT_ID = String(cfg.clientId).trim();
  if (cfg.clientSecret) process.env.GOOGLE_CLIENT_SECRET = String(cfg.clientSecret).trim();
  if (cfg.redirectUri) process.env.GOOGLE_REDIRECT_URI = String(cfg.redirectUri).trim();
}

export function googleConfigured() {
  // redirect_uri puede venir del host de la petición; basta con client id/secret.
  return Boolean(env('GOOGLE_CLIENT_ID') && env('GOOGLE_CLIENT_SECRET'));
}

/** Carga credenciales desde env, archivo local o Neon (sobrevive redeploys de Hostinger). */
export async function ensureGoogleCredsLoaded() {
  if (googleConfigured()) return true;
  if (!credsLoadPromise) {
    credsLoadPromise = (async () => {
      try {
        if (fs.existsSync(OAUTH_FILE)) {
          const raw = JSON.parse(fs.readFileSync(OAUTH_FILE, 'utf8'));
          applyCreds({
            clientId: raw.clientId || raw.GOOGLE_CLIENT_ID,
            clientSecret: raw.clientSecret || raw.GOOGLE_CLIENT_SECRET,
            redirectUri: raw.redirectUri || raw.GOOGLE_REDIRECT_URI,
          });
          if (googleConfigured()) return true;
        }
      } catch {
        /* ignore */
      }

      try {
        const { databaseUrl, sql } = await import('./db.mjs');
        if (!databaseUrl()) return googleConfigured();
        const rows = await sql`SELECT state FROM app_state WHERE key = ${OAUTH_DB_KEY} LIMIT 1`;
        const state = rows[0]?.state;
        if (state && typeof state === 'object') {
          applyCreds(state);
        }
      } catch (err) {
        console.warn('No se pudieron cargar credenciales Google desde DB:', err?.message ?? err);
      }
      return googleConfigured();
    })().finally(() => {
      // Permitir reintento si aún no hay creds
      if (!googleConfigured()) credsLoadPromise = null;
    });
  }
  return credsLoadPromise;
}

/** Guarda credenciales en archivo + Neon para que no se pierdan en Hostinger. */
export async function saveGoogleOAuthConfig({ clientId, clientSecret, redirectUri }) {
  const cfg = {
    clientId: String(clientId || '').trim(),
    clientSecret: String(clientSecret || '').trim(),
    redirectUri: String(
      redirectUri ||
        env('GOOGLE_REDIRECT_URI') ||
        'https://darkred-wasp-801835.hostingersite.com/api/google/callback',
    ).trim(),
  };
  if (!cfg.clientId || !cfg.clientSecret || !cfg.redirectUri) {
    throw new Error('Faltan clientId, clientSecret o redirectUri');
  }
  applyCreds(cfg);
  ensureDataDir();
  fs.writeFileSync(OAUTH_FILE, JSON.stringify(cfg, null, 2));

  try {
    const { databaseUrl, sql } = await import('./db.mjs');
    if (databaseUrl()) {
      const json = JSON.stringify(cfg);
      await sql`
        INSERT INTO app_state (key, state, updated_at)
        VALUES (${OAUTH_DB_KEY}, ${json}::jsonb, now())
        ON CONFLICT (key) DO UPDATE SET state = ${json}::jsonb, updated_at = now()
      `;
    }
  } catch (err) {
    console.warn('Credenciales guardadas en archivo; DB falló:', err?.message ?? err);
  }
  credsLoadPromise = Promise.resolve(true);
  return cfg;
}

function redirectUri() {
  return env(
    'GOOGLE_REDIRECT_URI',
    'https://darkred-wasp-801835.hostingersite.com/api/google/callback',
  );
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readTokensFromFile() {
  try {
    if (fs.existsSync(TOKENS_PATH)) {
      return JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
    }
  } catch {
    /* ignore */
  }
  return {};
}

/** Tokens en archivo + Neon (Hostinger borra el disco del contenedor en cada deploy). */
export async function loadGoogleTokens() {
  if (tokensMemory) return tokensMemory;
  if (!tokensLoadPromise) {
    tokensLoadPromise = (async () => {
      let all = readTokensFromFile();
      try {
        const { databaseUrl, sql } = await import('./db.mjs');
        if (databaseUrl()) {
          const rows = await sql`
            SELECT state FROM app_state WHERE key = ${TOKENS_DB_KEY} LIMIT 1
          `;
          const state = rows[0]?.state;
          if (state && typeof state === 'object') {
            all = { ...all, ...state };
          }
        }
      } catch (err) {
        console.warn('No se pudieron cargar tokens Google desde DB:', err?.message ?? err);
      }
      tokensMemory = all;
      return all;
    })().finally(() => {
      if (!tokensMemory) tokensLoadPromise = null;
    });
  }
  return tokensLoadPromise;
}

async function persistGoogleTokens(all) {
  tokensMemory = all;
  try {
    ensureDataDir();
    fs.writeFileSync(TOKENS_PATH, JSON.stringify(all, null, 2));
  } catch (err) {
    console.warn('No se pudo escribir google-tokens.json:', err?.message ?? err);
  }
  try {
    const { databaseUrl, sql } = await import('./db.mjs');
    if (databaseUrl()) {
      const json = JSON.stringify(all);
      await sql`
        INSERT INTO app_state (key, state, updated_at)
        VALUES (${TOKENS_DB_KEY}, ${json}::jsonb, now())
        ON CONFLICT (key) DO UPDATE SET state = ${json}::jsonb, updated_at = now()
      `;
    }
  } catch (err) {
    console.warn('Tokens Google no persistieron en DB:', err?.message ?? err);
  }
}

export function encodeGoogleOAuthState(userId, oauthRedirectUri, ownerName = '') {
  const payload = JSON.stringify({
    u: userId || GOOGLE_CAL_USER_ID,
    r: oauthRedirectUri || redirectUri(),
    n: ownerName || '',
  });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

export function decodeGoogleOAuthState(state) {
  const raw = String(state || '').trim();
  if (!raw) {
    return { userId: GOOGLE_CAL_USER_ID, redirectUri: redirectUri(), ownerName: '' };
  }
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed = JSON.parse(json);
    if (parsed?.u) {
      return {
        userId: String(parsed.u),
        redirectUri: parsed.r ? String(parsed.r) : redirectUri(),
        ownerName: parsed.n ? String(parsed.n) : '',
      };
    }
  } catch {
    /* legacy: state era solo el userId */
  }
  return { userId: raw, redirectUri: redirectUri(), ownerName: '' };
}

export function getGoogleStatus(userId = GOOGLE_CAL_USER_ID) {
  const entry = (tokensMemory || readTokensFromFile())[userId];
  return {
    configured: googleConfigured(),
    connected: Boolean(entry?.refresh_token || entry?.access_token),
    userId,
    email: entry?.email ?? null,
    lastSyncAt: entry?.lastSyncAt ?? null,
    lastError: entry?.lastError ?? null,
    eventCount: entry?.eventCount ?? null,
  };
}

export async function getGoogleStatusAsync(userId = GOOGLE_CAL_USER_ID) {
  await ensureGoogleCredsLoaded();
  await loadGoogleTokens();
  return getGoogleStatus(userId);
}

export function getGoogleAuthUrl(userId = GOOGLE_CAL_USER_ID, oauthRedirectUri, ownerName = '') {
  if (!googleConfigured()) {
    throw new Error('Google Calendar no configurado: faltan variables GOOGLE_*');
  }
  const redir = String(oauthRedirectUri || redirectUri()).trim();
  if (oauthRedirectUri) applyCreds({ redirectUri: redir });
  const params = new URLSearchParams({
    client_id: env('GOOGLE_CLIENT_ID'),
    redirect_uri: redir,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: encodeGoogleOAuthState(userId, redir, ownerName),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function exchangeCode(code, oauthRedirectUri) {
  const body = new URLSearchParams({
    code,
    client_id: env('GOOGLE_CLIENT_ID'),
    client_secret: env('GOOGLE_CLIENT_SECRET'),
    redirect_uri: String(oauthRedirectUri || redirectUri()).trim(),
    grant_type: 'authorization_code',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || 'Error al canjear código OAuth');
  }
  return data;
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: env('GOOGLE_CLIENT_ID'),
    client_secret: env('GOOGLE_CLIENT_SECRET'),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || 'Error al refrescar token');
  }
  return data;
}

async function googleGet(accessToken, url) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.message || `Google API falló (${res.status})`);
  }
  return data;
}

async function getValidAccessToken(userId) {
  const all = await loadGoogleTokens();
  const entry = all[userId];
  if (!entry) throw new Error('Google Calendar no conectado para este usuario');

  const expiresAt = entry.expires_at ? Date.parse(entry.expires_at) : 0;
  if (entry.access_token && expiresAt > Date.now() + 60_000) {
    return entry.access_token;
  }
  if (!entry.refresh_token) {
    throw new Error('Sin refresh token; vuelve a conectar Google Calendar');
  }

  const refreshed = await refreshAccessToken(entry.refresh_token);
  const next = {
    ...entry,
    access_token: refreshed.access_token,
    expires_at: new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString(),
    lastError: null,
  };
  if (refreshed.refresh_token) next.refresh_token = refreshed.refresh_token;
  all[userId] = next;
  await persistGoogleTokens(all);
  return next.access_token;
}

export async function handleGoogleOAuthCallback(code, stateRaw, redirectOverride) {
  const {
    userId,
    redirectUri: fromState,
    ownerName: ownerFromState,
  } = decodeGoogleOAuthState(stateRaw);
  const candidates = [
    ...new Set(
      [redirectOverride, fromState, redirectUri()]
        .map((v) => String(v || '').trim())
        .filter(Boolean),
    ),
  ];

  let tokens = null;
  let lastError = null;
  for (const redir of candidates) {
    try {
      tokens = await exchangeCode(code, redir);
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (!tokens) {
    throw lastError || new Error('Error al canjear código OAuth');
  }
  const accessToken = tokens.access_token;

  let email = null;
  try {
    const me = await googleGet(accessToken, 'https://www.googleapis.com/oauth2/v2/userinfo');
    email = me.email || null;
  } catch {
    /* optional */
  }

  const all = await loadGoogleTokens();
  all[userId] = {
    ...(all[userId] ?? {}),
    access_token: accessToken,
    refresh_token: tokens.refresh_token || all[userId]?.refresh_token,
    expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
    email,
    ownerName: ownerFromState || all[userId]?.ownerName || null,
    connectedAt: new Date().toISOString(),
    lastError: null,
  };
  await persistGoogleTokens(all);
  return { userId, email };
}

const DISPLAY_TZ = 'America/Mexico_City';

/** Fecha/hora locales en zona de la empresa (Hostinger suele ser UTC). */
function localPartsFromDate(d) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: DISPLAY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    ms: d.getTime(),
  };
}

/** ID estable y único (antes se truncaba el calendarId:eventId y chocaban muchos). */
function stableGoogleEventId(userId, externalId) {
  const hash = crypto.createHash('sha1').update(String(externalId)).digest('hex').slice(0, 24);
  return `google-${String(userId).slice(0, 12)}-${hash}`;
}

/** Días YMD desde start hasta end (inclusive). */
function eachYmdInclusive(startYmd, endYmd) {
  if (!startYmd) return [];
  if (!endYmd || endYmd < startYmd) return [startYmd];
  const out = [];
  let cur = startYmd;
  while (cur <= endYmd) {
    out.push(cur);
    cur = addDaysYmd(cur, 1);
    if (out.length > 400) break;
  }
  return out;
}

function mapGoogleEvent(ev, userId, ownerName = '') {
  if (ev.status === 'cancelled') return [];

  let start;
  let end;
  let allDay = false;
  let startYmd;
  let endYmdInclusive;
  let startTime = '09:00';

  if (ev.start?.dateTime) {
    start = new Date(ev.start.dateTime);
    end = ev.end?.dateTime ? new Date(ev.end.dateTime) : new Date(start.getTime() + 60 * 60_000);
    if (Number.isNaN(start.getTime())) return [];
    const startParts = localPartsFromDate(start);
    startYmd = startParts.date;
    startTime = startParts.time;
    // Si termina a medianoche exacta, el último día no cuenta (igual que Google).
    const endParts = localPartsFromDate(end);
    if (endParts.time === '00:00' && end.getTime() > start.getTime()) {
      endYmdInclusive = addDaysYmd(endParts.date, -1);
    } else {
      endYmdInclusive = endParts.date;
    }
  } else if (ev.start?.date) {
    // All-day: end.date de Google es exclusivo.
    allDay = true;
    startYmd = String(ev.start.date).slice(0, 10);
    const endExclusive = String(ev.end?.date || ev.start.date).slice(0, 10);
    endYmdInclusive = addDaysYmd(endExclusive, -1);
    if (endYmdInclusive < startYmd) endYmdInclusive = startYmd;
    start = new Date(`${startYmd}T09:00:00-06:00`);
    end = new Date(`${addDaysYmd(endYmdInclusive, 1)}T10:00:00-06:00`);
  } else {
    return [];
  }
  if (Number.isNaN(start.getTime())) return [];

  const days = eachYmdInclusive(startYmd, endYmdInclusive);
  const estimatedMinutes = allDay
    ? 8 * 60
    : Math.max(15, Math.round((end.getTime() - start.getTime()) / 60_000) || 60);
  const baseExternalId = ev._calendarId
    ? `${ev._calendarId}:${ev.id || Date.now()}`
    : String(ev.id || '');
  const transparency = String(ev.transparency || '').toLowerCase();
  const showAsFree = transparency === 'transparent';
  const title = (ev.summary || '').trim() || '(Sin título)';
  const notes = [
    allDay ? 'Todo el día' : '',
    days.length > 1 ? `${days.length} días` : '',
    (ev.description || '').trim().slice(0, 450),
    ev._calendarSummary ? String(ev._calendarSummary) : '',
  ]
    .filter(Boolean)
    .join(' · ')
    .slice(0, 500);

  return days.map((date, index) => {
    const externalId = days.length > 1 ? `${baseExternalId}#${date}` : baseExternalId;
    return {
      id: stableGoogleEventId(userId, externalId),
      userId,
      title,
      date,
      time: allDay ? '09:00' : index === 0 ? startTime : '00:00',
      reminderMinutes: 15,
      estimatedMinutes: allDay ? estimatedMinutes : index === 0 ? estimatedMinutes : 60,
      trackedMinutes: 0,
      done: false,
      notes,
      source: 'google',
      externalId,
      shared: false,
      ownerName: ownerName || 'Colaborador',
      kind: showAsFree ? 'event' : 'busy',
      showAsFree,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
    };
  });
}

function mexicoYmdWeekday(d = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: DISPLAY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const bag = Object.fromEntries(
    fmt
      .formatToParts(d)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  );
  const weekdayMap = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return {
    ymd: `${bag.year}-${bag.month}-${bag.day}`,
    mondayOffset: weekdayMap[bag.weekday] ?? 0,
  };
}

function addDaysYmd(ymd, days) {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Ventana: ~2 años atrás → ~1 año adelante (México). */
function windowRange() {
  const { ymd } = mexicoYmdWeekday();
  const startYmd = addDaysYmd(ymd, -SYNC_LOOKBACK_DAYS);
  const endYmd = addDaysYmd(ymd, SYNC_LOOKAHEAD_DAYS);
  return {
    start: new Date(`${startYmd}T00:00:00-06:00`),
    end: new Date(`${endYmd}T23:59:59-06:00`),
  };
}

async function listGoogleCalendarIds(accessToken) {
  const calendars = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({
      minAccessRole: 'reader',
      maxResults: '250',
      showHidden: 'true',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const payload = await googleGet(
      accessToken,
      `https://www.googleapis.com/calendar/v3/users/me/calendarList?${params}`,
    );
    for (const cal of payload.items || []) {
      if (!cal?.id) continue;
      calendars.push({
        id: String(cal.id),
        summary: String(cal.summary || cal.id),
        primary: Boolean(cal.primary),
        selected: cal.selected !== false,
      });
    }
    pageToken = payload.nextPageToken || '';
  } while (pageToken);

  if (!calendars.some((c) => c.primary || c.id === 'primary')) {
    calendars.unshift({ id: 'primary', summary: 'Primary', primary: true, selected: true });
  }
  return calendars;
}

async function fetchGoogleEventsForCalendar(accessToken, calendarId, start, end) {
  const items = [];
  let pageToken = '';
  const encodedId = encodeURIComponent(calendarId);
  do {
    const params = new URLSearchParams({
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
      showDeleted: 'false',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const payload = await googleGet(
      accessToken,
      `https://www.googleapis.com/calendar/v3/calendars/${encodedId}/events?${params}`,
    );
    items.push(...(payload.items || []));
    pageToken = payload.nextPageToken || '';
  } while (pageToken && items.length < 10000);
  return items;
}

/** Diagnóstico: cuántos eventos de agosto trae cada calendario de Google. */
export async function diagnoseGoogleCalendars(userId = GOOGLE_CAL_USER_ID) {
  const accessToken = await getValidAccessToken(userId);
  const calendarList = await listGoogleCalendarIds(accessToken);
  const start = new Date('2026-08-01T00:00:00-06:00');
  const end = new Date('2026-08-31T23:59:59-06:00');
  const calendars = [];
  for (const cal of calendarList.slice(0, 40)) {
    try {
      const items = await fetchGoogleEventsForCalendar(accessToken, cal.id, start, end);
      calendars.push({
        id: cal.id,
        summary: cal.summary,
        primary: Boolean(cal.primary),
        selected: Boolean(cal.selected),
        august2026: items.length,
        sample: items.slice(0, 8).map((ev) => ({
          title: (ev.summary || '').trim() || '(Sin título)',
          start: ev.start?.dateTime || ev.start?.date || null,
        })),
      });
    } catch (err) {
      calendars.push({
        id: cal.id,
        summary: cal.summary,
        primary: Boolean(cal.primary),
        selected: Boolean(cal.selected),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return {
    userId,
    august2026Total: calendars.reduce((n, c) => n + (c.august2026 || 0), 0),
    calendars,
  };
}

/**
 * Pull Google Calendar events into app state.
 * @param {() => object | Promise<object>} readState
 * @param {(state: object) => void | Promise<void>} writeState
 */
export async function syncGoogleCalendar(readState, writeState, userId = GOOGLE_CAL_USER_ID) {
  const accessToken = await getValidAccessToken(userId);
  const tokenEntry = (await loadGoogleTokens())[userId] || {};
  const ownerName =
    userId === GOOGLE_CAL_USER_ID
      ? tokenEntry.ownerName || 'Orlando Villagómez'
      : tokenEntry.ownerName || tokenEntry.email || userId;
  const { start, end } = windowRange();

  const calendarList = await listGoogleCalendarIds(accessToken);
  // Incluir todos los calendarios (no solo los “selected”); Orlando ve más días en Gmail.
  const primary = calendarList.filter((c) => c.primary || c.id === 'primary');
  const rest = calendarList.filter((c) => !(c.primary || c.id === 'primary'));
  const targets = [...primary, ...rest].slice(0, 40);

  // Pasada extra del mes actual ±45 días para no perder la agenda cercana.
  const nearStart = new Date(Date.now() - 45 * 24 * 60 * 60_000);
  const nearEnd = new Date(Date.now() + 45 * 24 * 60 * 60_000);

  const items = [];
  const seen = new Set();
  const skipped = [];
  for (const cal of targets) {
    try {
      const batches = [
        await fetchGoogleEventsForCalendar(accessToken, cal.id, start, end),
        await fetchGoogleEventsForCalendar(accessToken, cal.id, nearStart, nearEnd),
      ];
      for (const batch of batches) {
        for (const ev of batch) {
          const key = `${cal.id}:${ev.id || ev.iCalUID || Math.random()}`;
          if (seen.has(key)) continue;
          seen.add(key);
          items.push({ ...ev, _calendarSummary: cal.summary, _calendarId: cal.id });
        }
      }
    } catch (err) {
      skipped.push({
        id: cal.id,
        summary: cal.summary,
        error: err instanceof Error ? err.message : String(err),
      });
      console.warn(
        `Google calendar ${cal.id} sync skip:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  const mapped = items.flatMap((ev) => mapGoogleEvent(ev, userId, ownerName));

  const busySlots = mapped
    .filter((e) => !e.showAsFree)
    .map((e) => ({
      userId,
      start: e.startIso,
      end: e.endIso,
    }))
    .sort((a, b) => a.start.localeCompare(b.start));

  const calendarEvents = mapped.map(
    ({ showAsFree: _f, startIso: _s, endIso: _e, ...rest }) => rest,
  );

  const state = await readState();
  const calendars = { ...(state.calendars || {}) };
  const current = calendars[userId] || { events: [], activeTimer: null };
  const localEvents = (current.events || []).filter(
    (e) => e.source !== 'google',
  );
  const prevGoogle = new Map(
    (current.events || [])
      .filter((e) => e.source === 'google' && e.externalId)
      .map((e) => [e.externalId, e]),
  );

  const googleEvents = calendarEvents.map((ev) => {
    const prev = prevGoogle.get(ev.externalId);
    if (!prev) return ev;
    return {
      ...ev,
      trackedMinutes: prev.trackedMinutes ?? 0,
      done: prev.done || ev.done,
      remindedAt: prev.remindedAt,
      emailRemindedAt: prev.emailRemindedAt,
      notes: prev.notes?.trim() ? prev.notes : ev.notes,
    };
  });

  calendars[userId] = {
    events: [...localEvents, ...googleEvents].sort((a, b) =>
      `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
    ),
    activeTimer: current.activeTimer,
  };

  const nextState = {
    ...state,
    calendars,
    busySlots: {
      ...(state.busySlots || {}),
      [userId]: busySlots,
    },
    updatedAt: new Date().toISOString(),
  };
  await writeState(nextState);

  const all = await loadGoogleTokens();
  if (all[userId]) {
    all[userId] = {
      ...all[userId],
      lastSyncAt: new Date().toISOString(),
      lastError: null,
      eventCount: googleEvents.length,
    };
    await persistGoogleTokens(all);
  }

  return {
    userId,
    eventCount: googleEvents.length,
    busyCount: busySlots.length,
    calendarsSynced: targets.length,
    calendarsSkipped: skipped,
    syncedAt: all[userId]?.lastSyncAt,
  };
}

export async function recordGoogleSyncError(userId, error) {
  const all = await loadGoogleTokens();
  if (!all[userId]) return;
  all[userId] = {
    ...all[userId],
    lastError: error instanceof Error ? error.message : String(error),
  };
  await persistGoogleTokens(all);
}

/** Usuarios con Google Calendar vinculado (cualquier colaborador). */
export async function listConnectedGoogleUserIds() {
  const all = await loadGoogleTokens();
  return Object.entries(all)
    .filter(([, entry]) => Boolean(entry?.refresh_token || entry?.access_token))
    .map(([id]) => id);
}

/** Sincroniza todos los Gmail vinculados al dashboard. */
export async function syncAllGoogleCalendars(readState, writeState) {
  const userIds = await listConnectedGoogleUserIds();
  const results = [];
  for (const userId of userIds) {
    try {
      results.push(await syncGoogleCalendar(readState, writeState, userId));
    } catch (err) {
      await recordGoogleSyncError(userId, err);
      results.push({
        userId,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}

const EXTERNAL_SOURCES = new Set(['google', 'outlook']);

/** Merge calendars on client PUT without wiping synced external events. */
export function mergeCalendarsPreservingExternal(existing = {}, incoming = {}) {
  const userIds = new Set([...Object.keys(existing), ...Object.keys(incoming)]);
  const merged = {};
  for (const id of userIds) {
    const prev = existing[id];
    const next = incoming[id];
    if (!next) {
      merged[id] = prev;
      continue;
    }
    if (!prev) {
      merged[id] = next;
      continue;
    }
    const local = (next.events || []).filter((e) => !EXTERNAL_SOURCES.has(e.source));
    const extIncoming = (next.events || []).filter((e) => EXTERNAL_SOURCES.has(e.source));
    const extPrev = (prev.events || []).filter((e) => EXTERNAL_SOURCES.has(e.source));
    const googleIn = extIncoming.filter((e) => e.source === 'google');
    const googlePrev = extPrev.filter((e) => e.source === 'google');
    const otherIn = extIncoming.filter((e) => e.source !== 'google');
    const otherPrev = extPrev.filter((e) => e.source !== 'google');
    // Google: si el cliente/sync manda eventos, reemplazan (evita IDs viejos).
    // Si manda vacío, conservar los del servidor.
    const google = googleIn.length === 0 ? googlePrev : googleIn;
    // Outlook/otros: unir por externalId para no perder importaciones.
    const otherByExt = new Map();
    for (const e of otherPrev) {
      otherByExt.set(e.externalId || `id:${e.id}`, e);
    }
    for (const e of otherIn) {
      otherByExt.set(e.externalId || `id:${e.id}`, e);
    }
    const other =
      otherIn.length === 0 ? otherPrev : otherPrev.length === 0 ? otherIn : [...otherByExt.values()];
    const external = [...google, ...other];
    merged[id] = {
      ...next,
      events: [...local, ...external].sort((a, b) =>
        `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
      ),
    };
  }
  return merged;
}
