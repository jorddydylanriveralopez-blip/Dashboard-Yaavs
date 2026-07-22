import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// El cálculo de __dirname con import.meta.url puede fallar al empaquetar la
// función (Netlify/esbuild). En serverless no usamos el archivo local, así que
// se protege con un fallback nulo.
let LOCAL_DB_PATH = null;
try {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  LOCAL_DB_PATH = path.join(dir, 'data', 'store.json');
} catch {
  LOCAL_DB_PATH = null;
}
const BLOB_STATE_PATH = 'app-state/state.json';
const STATE_KEY = 'yaavs-board';

function isServerless() {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.NETLIFY,
  );
}

function databaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL ||
    null
  );
}

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN || null;
}

function blobOptions(extra = {}) {
  const token = blobToken();
  return token ? { ...extra, token } : extra;
}

export function emptyAppState() {
  return {
    board: { companyName: 'Yaavs', tasks: [] },
    assignments: [],
    chatMessages: [],
    calendars: {},
    passwordOverrides: {},
    teamRoster: { added: [], removedUserIds: [] },
    // Fecha antigua fija: un estado vacío nunca debe "ganarle" al estado
    // local de un dispositivo (el cliente compara por updatedAt).
    updatedAt: '1970-01-01T00:00:00.000Z',
  };
}

function stateProjectCount(state) {
  return Array.isArray(state?.board?.projects) ? state.board.projects.length : 0;
}

function stateTaskCount(state) {
  return Array.isArray(state?.board?.tasks) ? state.board.tasks.length : 0;
}

/** ¿Hay datos reales de tablero (no el placeholder vacío)? */
function isMeaningfulState(state) {
  if (!state?.board) return false;
  return stateProjectCount(state) > 0 || stateTaskCount(state) > 0;
}

/** Guard: no permitir borrar proyectos existentes con un estado que tenga muchos menos. */
function wouldWipeProjects(incoming, existing) {
  const existingCount = stateProjectCount(existing);
  const incomingCount = stateProjectCount(incoming);
  // Si había proyectos y el nuevo estado trae 0 (o pierde más de la mitad), rechazar.
  if (existingCount >= 3 && incomingCount === 0) return true;
  if (existingCount >= 5 && incomingCount < Math.floor(existingCount / 2)) return true;
  return false;
}

function preferRicherState(a, b) {
  if (!a) return b;
  if (!b) return a;
  const aAt = a.updatedAt || '';
  const bAt = b.updatedAt || '';
  if (isMeaningfulState(a) && !isMeaningfulState(b)) return a;
  if (isMeaningfulState(b) && !isMeaningfulState(a)) return b;
  return aAt >= bAt ? a : b;
}

function readLocalState() {
  if (!LOCAL_DB_PATH) return null;
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      return JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf8'));
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeLocalState(state) {
  if (!LOCAL_DB_PATH) return;
  fs.mkdirSync(path.dirname(LOCAL_DB_PATH), { recursive: true });
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(state, null, 2));
}

async function loadStateFromPostgres() {
  try {
    const { sql } = await import('./db.mjs');
    const rows = await sql`SELECT state FROM app_state WHERE key = ${STATE_KEY} LIMIT 1`;
    if (rows.length && rows[0].state) return rows[0].state;
    return null;
  } catch (error) {
    console.error('loadStateFromPostgres failed:', error?.message ?? error);
    return null;
  }
}

async function saveStateToPostgres(state) {
  const { sql } = await import('./db.mjs');
  const json = JSON.stringify(state);
  await sql`
    INSERT INTO app_state (key, state, updated_at)
    VALUES (${STATE_KEY}, ${json}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET state = ${json}::jsonb, updated_at = now()
  `;
}

async function loadStateFromBlob() {
  try {
    const { head } = await import('@vercel/blob');
    const meta = await head(BLOB_STATE_PATH, blobOptions());
    if (!meta?.url) return null;
    // Cache-buster: la URL pública de Blob se sirve con caché de CDN.
    const url = `${meta.url}${meta.url.includes('?') ? '&' : '?'}ts=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error('loadStateFromBlob failed:', error?.message ?? error);
    return null;
  }
}

async function saveStateToBlob(state) {
  const { put } = await import('@vercel/blob');
  await put(
    BLOB_STATE_PATH,
    JSON.stringify(state),
    blobOptions({
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    }),
  );
}

/** Estado compartido del panel: Neon Postgres primero, Blob como respaldo, archivo local en dev. */
export async function loadAppState() {
  let fromDb = null;
  let fromBlob = null;

  if (databaseUrl()) {
    fromDb = await loadStateFromPostgres();
  }
  if (blobToken() || isServerless()) {
    fromBlob = await loadStateFromBlob();
  }

  const preferred = preferRicherState(fromDb, fromBlob);
  if (preferred && isMeaningfulState(preferred)) return preferred;
  if (preferred) return preferred;

  if (!isServerless()) {
    const local = readLocalState();
    if (local) return local;
  }
  return emptyAppState();
}

/**
 * Guarda el estado completo.
 * Si Neon falla (cuota, red, etc.), cae a Blob para no perder sync ni Concluidos.
 * Rechaza un tablero vacío que pisaría datos existentes (salvo allowEmpty).
 */
export async function saveAppState(body, { allowEmpty = false } = {}) {
  const state = { ...body, updatedAt: new Date().toISOString() };

  if (!allowEmpty && !isMeaningfulState(state)) {
    let existing = null;
    if (databaseUrl()) existing = await loadStateFromPostgres();
    if (!existing && (blobToken() || isServerless())) existing = await loadStateFromBlob();
    if (!existing && !isServerless()) existing = readLocalState();
    if (isMeaningfulState(existing)) {
      throw new Error(
        'Se rechazó guardar un tablero vacío sobre datos existentes. Usa allowEmpty si es intencional.',
      );
    }
  }

  // Protección extra: no pisar un tablero con muchos proyectos con uno casi vacío
  // (aunque todavía tenga tareas y pase isMeaningfulState).
  if (!allowEmpty) {
    let existing = null;
    if (databaseUrl()) existing = await loadStateFromPostgres();
    if (!existing && (blobToken() || isServerless())) existing = await loadStateFromBlob();
    if (!existing && !isServerless()) existing = readLocalState();
    if (wouldWipeProjects(state, existing)) {
      throw new Error(
        'Se rechazó guardar: el estado nuevo borraría proyectos existentes. Usa allowEmpty si es intencional.',
      );
    }
  }

  const errors = [];

  if (databaseUrl()) {
    try {
      await saveStateToPostgres(state);
      // Intentar también Blob como espejo (no bloquea si falla).
      if (blobToken()) {
        try {
          await saveStateToBlob(state);
        } catch (mirrorErr) {
          console.error('Blob mirror save failed:', mirrorErr?.message ?? mirrorErr);
        }
      }
      return state;
    } catch (error) {
      console.error('saveStateToPostgres failed, trying Blob:', error?.message ?? error);
      errors.push(error);
    }
  }

  if (blobToken() || isServerless()) {
    try {
      await saveStateToBlob(state);
      return state;
    } catch (error) {
      console.error('saveStateToBlob failed:', error?.message ?? error);
      errors.push(error);
    }
  }

  if (!isServerless()) {
    writeLocalState(state);
    return state;
  }

  const message =
    errors.map((e) => (e instanceof Error ? e.message : String(e))).join(' | ') ||
    'No se pudo guardar el estado';
  throw new Error(message);
}
