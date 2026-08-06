import { databaseUrl, sql } from './db.mjs';

const OUTLOOK_ICS_DB_KEY = 'yaavs-outlook-ics';
const ORLANDO_USER_ID = 'u-orlando';
const DISPLAY_TZ = 'America/Mexico_City';

let configMemory = null;
let configLoadPromise = null;

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
    fmt
      .formatToParts(d)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function addDaysYmd(ymd, days) {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

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

function unfoldIcs(raw) {
  return String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n[ \t]/g, '');
}

function unescapeIcsText(value) {
  return String(value || '')
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function fieldValue(line, name) {
  const upper = line.toUpperCase();
  if (!upper.startsWith(name) && !upper.startsWith(`${name};`)) return null;
  const idx = line.indexOf(':');
  if (idx < 0) return null;
  return line.slice(idx + 1);
}

/** Parsea DTSTART/DTEND ics → { ymd, time, allDay, ms }. */
function parseIcsDateTime(line) {
  const upper = line.toUpperCase();
  const allDay = upper.includes('VALUE=DATE');
  const raw = line.replace(/^[^:]*:/, '').trim();
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?/);
  if (!m) return null;
  const ymd = `${m[1]}-${m[2]}-${m[3]}`;
  if (allDay || m[4] == null) {
    return {
      ymd,
      time: '09:00',
      allDay: true,
      ms: new Date(`${ymd}T12:00:00-06:00`).getTime(),
    };
  }
  const hh = m[4];
  const mm = m[5];
  const ss = m[6] || '00';
  const isUtc = Boolean(m[7]);
  const d = isUtc
    ? new Date(`${m[1]}-${m[2]}-${m[3]}T${hh}:${mm}:${ss}Z`)
    : new Date(`${m[1]}-${m[2]}-${m[3]}T${hh}:${mm}:${ss}-06:00`);
  if (Number.isNaN(d.getTime())) return null;
  const parts = localPartsFromDate(d);
  return { ymd: parts.date, time: parts.time, allDay: false, ms: d.getTime() };
}

export function parseOutlookIcsText(icsText) {
  const text = unfoldIcs(icsText);
  const lines = text.split('\n');
  const events = [];
  let inEvent = false;
  let summary = '';
  let description = '';
  let uid = '';
  let start = null;
  let end = null;

  const flush = () => {
    if (!start || !summary.trim()) {
      summary = '';
      description = '';
      uid = '';
      start = null;
      end = null;
      return;
    }
    let endYmd = start.ymd;
    if (end) {
      if (start.allDay || end.allDay) {
        // DTEND all-day is exclusive
        endYmd = addDaysYmd(end.ymd, -1);
        if (endYmd < start.ymd) endYmd = start.ymd;
      } else if (end.time === '00:00' && end.ms > start.ms) {
        endYmd = addDaysYmd(end.ymd, -1);
      } else {
        endYmd = end.ymd;
      }
    }
    const days = eachYmdInclusive(start.ymd, endYmd);
    const baseUid = uid.trim() || `${summary}-${start.ymd}-${start.time}`;
    for (let i = 0; i < days.length; i += 1) {
      const date = days[i];
      const externalId =
        days.length > 1 ? `outlook-ics:${baseUid}#${date}` : `outlook-ics:${baseUid}`;
      events.push({
        title: unescapeIcsText(summary.trim()),
        date,
        time: start.allDay ? '09:00' : i === 0 ? start.time : '00:00',
        notes: [
          start.allDay ? 'Todo el día' : '',
          days.length > 1 ? `${days.length} días` : '',
          unescapeIcsText(description.trim()).slice(0, 450),
          'Outlook / Hotmail',
        ]
          .filter(Boolean)
          .join(' · ')
          .slice(0, 500),
        externalId,
        estimatedMinutes: start.allDay
          ? 8 * 60
          : Math.max(15, end && end.ms > start.ms ? Math.round((end.ms - start.ms) / 60_000) : 60),
        kind: 'busy',
      });
    }
    summary = '';
    description = '';
    uid = '';
    start = null;
    end = null;
  };

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper === 'BEGIN:VEVENT') {
      inEvent = true;
      summary = '';
      description = '';
      uid = '';
      start = null;
      end = null;
      continue;
    }
    if (upper === 'END:VEVENT') {
      if (inEvent) flush();
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;
    const sum = fieldValue(line, 'SUMMARY');
    if (sum != null) {
      summary = sum;
      continue;
    }
    const desc = fieldValue(line, 'DESCRIPTION');
    if (desc != null) {
      description = desc;
      continue;
    }
    const id = fieldValue(line, 'UID');
    if (id != null) {
      uid = id;
      continue;
    }
    if (upper.startsWith('DTSTART')) {
      start = parseIcsDateTime(line);
      continue;
    }
    if (upper.startsWith('DTEND')) {
      end = parseIcsDateTime(line);
    }
  }
  return events;
}

async function loadConfigFromDb() {
  if (!databaseUrl()) return null;
  try {
    const rows = await sql`SELECT state FROM app_state WHERE key = ${OUTLOOK_ICS_DB_KEY} LIMIT 1`;
    const state = rows?.[0]?.state;
    if (!state) return null;
    return typeof state === 'string' ? JSON.parse(state) : state;
  } catch (err) {
    console.warn('Outlook ICS config read:', err?.message ?? err);
    return null;
  }
}

async function saveConfigToDb(cfg) {
  if (!databaseUrl()) {
    configMemory = cfg;
    return cfg;
  }
  const json = JSON.stringify(cfg);
  await sql`
    INSERT INTO app_state (key, state, updated_at)
    VALUES (${OUTLOOK_ICS_DB_KEY}, ${json}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET state = ${json}::jsonb, updated_at = now()
  `;
  configMemory = cfg;
  return cfg;
}

export async function loadOutlookIcsConfig() {
  if (configMemory) return configMemory;
  if (configLoadPromise) return configLoadPromise;
  configLoadPromise = (async () => {
    const fromDb = await loadConfigFromDb();
    configMemory = fromDb || { url: '', userId: ORLANDO_USER_ID, lastSyncAt: null, lastError: null, eventCount: null };
    return configMemory;
  })();
  try {
    return await configLoadPromise;
  } finally {
    configLoadPromise = null;
  }
}

export async function getOutlookIcsStatus(userId = ORLANDO_USER_ID) {
  const cfg = await loadOutlookIcsConfig();
  return {
    configured: Boolean(cfg?.url),
    userId: cfg?.userId || userId,
    urlHost: cfg?.url ? safeHost(cfg.url) : null,
    lastSyncAt: cfg?.lastSyncAt ?? null,
    lastError: cfg?.lastError ?? null,
    eventCount: cfg?.eventCount ?? null,
  };
}

function safeHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export async function saveOutlookIcsUrl(url, userId = ORLANDO_USER_ID) {
  const trimmed = String(url || '').trim();
  if (!trimmed) throw new Error('Falta el enlace ICS de Outlook');
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('El enlace ICS no es válido');
  }
  if (!/^https?:$/i.test(parsed.protocol)) {
    throw new Error('El enlace debe ser https');
  }
  const cfg = {
    ...(await loadOutlookIcsConfig()),
    url: trimmed,
    userId,
    updatedAt: new Date().toISOString(),
    lastError: null,
  };
  await saveConfigToDb(cfg);
  return getOutlookIcsStatus(userId);
}

/**
 * Descarga el ICS publicado de Outlook/Hotmail y lo mezcla en la agenda de Orlando.
 */
export async function syncOutlookIcsCalendar(readState, writeState, userId = ORLANDO_USER_ID) {
  const cfg = await loadOutlookIcsConfig();
  if (!cfg?.url) throw new Error('No hay enlace ICS de Outlook configurado');

  const res = await fetch(cfg.url, {
    headers: { Accept: 'text/calendar, text/plain, */*' },
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`No se pudo leer el calendario Outlook (${res.status})`);
  }
  const text = await res.text();
  if (!/BEGIN:VCALENDAR/i.test(text)) {
    throw new Error('El enlace no devolvió un calendario .ics válido');
  }

  const imported = parseOutlookIcsText(text);
  const state = await readState();
  const calendars = { ...(state.calendars || {}) };
  const targetId = cfg.userId || userId || ORLANDO_USER_ID;
  const current = calendars[targetId] || { events: [], activeTimer: null };
  const keep = (current.events || []).filter((e) => e.source !== 'outlook');
  const prevOutlook = new Map(
    (current.events || [])
      .filter((e) => e.source === 'outlook' && e.externalId)
      .map((e) => [e.externalId, e]),
  );

  const outlookEvents = imported.map((item) => {
    const prev = prevOutlook.get(item.externalId);
    const idHash = Buffer.from(item.externalId).toString('base64url').slice(0, 24);
    return {
      id: prev?.id || `outlook-${targetId.slice(0, 8)}-${idHash}`,
      userId: targetId,
      title: item.title,
      date: item.date,
      time: item.time,
      reminderMinutes: 15,
      estimatedMinutes: item.estimatedMinutes,
      trackedMinutes: prev?.trackedMinutes ?? 0,
      done: prev?.done ?? false,
      notes: prev?.notes?.trim() ? prev.notes : item.notes,
      source: 'outlook',
      externalId: item.externalId,
      shared: false,
      ownerName: 'Orlando Villagómez',
      kind: item.kind || 'busy',
      remindedAt: prev?.remindedAt,
      emailRemindedAt: prev?.emailRemindedAt,
    };
  });

  calendars[targetId] = {
    events: [...keep, ...outlookEvents].sort((a, b) =>
      `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
    ),
    activeTimer: current.activeTimer,
  };

  const mergedBusy = (calendars[targetId].events || [])
    .filter((e) => !e.done && e.kind === 'busy')
    .map((e) => ({
      userId: targetId,
      start: `${e.date}T${e.time}:00-06:00`,
      end: `${e.date}T${e.time}:00-06:00`,
    }));

  await writeState({
    ...state,
    calendars,
    busySlots: {
      ...(state.busySlots || {}),
      [targetId]: mergedBusy,
    },
    updatedAt: new Date().toISOString(),
  });

  const nextCfg = {
    ...cfg,
    lastSyncAt: new Date().toISOString(),
    lastError: null,
    eventCount: outlookEvents.length,
  };
  await saveConfigToDb(nextCfg);

  return {
    userId: targetId,
    eventCount: outlookEvents.length,
    syncedAt: nextCfg.lastSyncAt,
  };
}

export async function recordOutlookIcsError(error) {
  const cfg = await loadOutlookIcsConfig();
  if (!cfg?.url) return;
  await saveConfigToDb({
    ...cfg,
    lastError: error instanceof Error ? error.message : String(error),
  });
}
