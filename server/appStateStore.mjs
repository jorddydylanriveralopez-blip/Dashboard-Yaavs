import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  externalizeProjectEvidence,
  mergeProgressUpdatesKeepEvidence,
} from './evidenceStore.mjs';

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
    process.env.SUPABASE_DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    null
  );
}

function supabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || null;
}

function supabaseKey() {
  return (
    process.env.SUPABASE_API_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    null
  );
}

function hasSupabaseApi() {
  return Boolean(supabaseUrl() && supabaseKey());
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
function completedProjectCount(state) {
  const projects = Array.isArray(state?.board?.projects) ? state.board.projects : [];
  return projects.filter((p) => p?.status === 'terminado').length;
}

function wouldWipeProjects(incoming, existing) {
  const existingCount = stateProjectCount(existing);
  const incomingCount = stateProjectCount(incoming);
  // Si había proyectos y el nuevo estado trae 0 (o pierde más de la mitad), rechazar.
  if (existingCount >= 3 && incomingCount === 0) return true;
  if (existingCount >= 5 && incomingCount < Math.floor(existingCount / 2)) return true;
  const existingDone = completedProjectCount(existing);
  const incomingDone = completedProjectCount(incoming);
  if (existingDone >= 1 && incomingDone < existingDone) return true;
  return false;
}

function mergeKeepExistingExtras(incoming, existing) {
  const byId = new Map();
  for (const e of Array.isArray(existing?.extraProjects) ? existing.extraProjects : []) {
    if (e?.id) byId.set(e.id, e);
  }
  for (const e of Array.isArray(incoming?.extraProjects) ? incoming.extraProjects : []) {
    if (!e?.id) continue;
    const cur = byId.get(e.id);
    if (!cur) {
      byId.set(e.id, e);
      continue;
    }
    if (String(e.updatedAt || e.createdAt || '') >= String(cur.updatedAt || cur.createdAt || '')) {
      byId.set(e.id, { ...cur, ...e });
    }
  }
  return {
    ...incoming,
    extraProjects: [...byId.values()],
  };
}

const DELETED_PROJECT_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 días

function pruneDeletedProjectIds(map, now = Date.now()) {
  const next = {};
  if (!map || typeof map !== 'object') return next;
  for (const [id, at] of Object.entries(map)) {
    const ts = Date.parse(String(at));
    if (!Number.isFinite(ts) || now - ts < DELETED_PROJECT_TTL_MS) {
      next[id] = at;
    }
  }
  return next;
}

function mergeDeletedProjectIds(...maps) {
  const merged = {};
  for (const map of maps) {
    if (!map || typeof map !== 'object') continue;
    for (const [id, at] of Object.entries(map)) {
      if (!merged[id] || String(at) > String(merged[id])) merged[id] = at;
    }
  }
  return pruneDeletedProjectIds(merged);
}


/**
 * Une proyectos del servidor con el push del cliente.
 * Nunca se pierden proyectos existentes sin tombstone; «terminado» gana a activo.
 */
function mergeKeepExistingProjects(incoming, existing, deletedProjectIds) {
  const byId = new Map();
  for (const p of Array.isArray(existing?.board?.projects) ? existing.board.projects : []) {
    if (p?.id && !deletedProjectIds?.[p.id]) byId.set(p.id, p);
  }
  for (const p of Array.isArray(incoming?.board?.projects) ? incoming.board.projects : []) {
    if (!p?.id || deletedProjectIds?.[p.id]) continue;
    const cur = byId.get(p.id);
    if (!cur) {
      byId.set(p.id, p);
      continue;
    }
    if (p.status === 'terminado' && cur.status !== 'terminado') {
      byId.set(p.id, {
        ...cur,
        ...p,
        status: 'terminado',
        progressUpdates: mergeProgressUpdatesKeepEvidence(
          p.progressUpdates,
          cur.progressUpdates,
        ),
      });
      continue;
    }
    if (cur.status === 'terminado' && p.status !== 'terminado') {
      continue;
    }
    if (String(p.updatedAt || '') >= String(cur.updatedAt || '')) {
      byId.set(p.id, {
        ...cur,
        ...p,
        progressUpdates: mergeProgressUpdatesKeepEvidence(
          p.progressUpdates,
          cur.progressUpdates,
        ),
      });
    }
  }
  return {
    ...incoming,
    board: {
      ...(incoming?.board ?? {}),
      projects: [...byId.values()],
    },
  };
}

function stripDeletedProjects(state, deletedProjectIds) {
  const projects = Array.isArray(state?.board?.projects) ? state.board.projects : [];
  const live = projects.filter((p) => p?.id && !deletedProjectIds[p.id]);
  return {
    ...state,
    board: {
      ...(state?.board ?? {}),
      projects: live,
    },
    deletedProjectIds,
  };
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

/** Hostinger inyecta SUPABASE_URL + SUPABASE_API_KEY (REST), no siempre DATABASE_URL. */
async function getSupabaseClient() {
  const url = supabaseUrl();
  const key = supabaseKey();
  if (!url || !key) return null;
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function loadStateFromSupabaseApi() {
  try {
    const client = await getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client
      .from('app_state')
      .select('state')
      .eq('key', STATE_KEY)
      .maybeSingle();
    if (error) throw error;
    return data?.state ?? null;
  } catch (error) {
    console.error('loadStateFromSupabaseApi failed:', error?.message ?? error);
    return null;
  }
}

async function saveStateToSupabaseApi(state) {
  const client = await getSupabaseClient();
  if (!client) throw new Error('Supabase API no configurada');
  const { error } = await client.from('app_state').upsert(
    {
      key: STATE_KEY,
      state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  );
  if (error) throw error;
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

async function loadExistingState() {
  if (databaseUrl()) {
    const fromPg = await loadStateFromPostgres();
    if (fromPg) return fromPg;
  }
  if (hasSupabaseApi()) {
    const fromApi = await loadStateFromSupabaseApi();
    if (fromApi) return fromApi;
  }
  if (blobToken() || isServerless()) {
    const fromBlob = await loadStateFromBlob();
    if (fromBlob) return fromBlob;
  }
  if (!isServerless()) return readLocalState();
  return null;
}

/** Estado compartido: Postgres (Neon/Supabase) → API Supabase (Hostinger) → Blob → local. */
export async function loadAppState() {
  let fromDb = null;
  let fromApi = null;
  let fromBlob = null;

  if (databaseUrl()) {
    fromDb = await loadStateFromPostgres();
  }
  if ((!fromDb || !isMeaningfulState(fromDb)) && hasSupabaseApi()) {
    fromApi = await loadStateFromSupabaseApi();
  }
  if (blobToken() || isServerless()) {
    fromBlob = await loadStateFromBlob();
  }

  const preferred = preferRicherState(preferRicherState(fromDb, fromApi), fromBlob);
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
 * Si Neon/Supabase Postgres falla, cae a API REST de Supabase y luego Blob.
 * Rechaza un tablero vacío que pisaría datos existentes (salvo allowEmpty).
 */
export async function saveAppState(body, { allowEmpty = false } = {}) {
  const existing = await loadExistingState();

  // Unir tombstones: un delete en cualquier cliente debe sobrevivir al push de otro.
  const deletedProjectIds = mergeDeletedProjectIds(
    existing?.deletedProjectIds,
    body?.deletedProjectIds,
  );

  let state = stripDeletedProjects(
    { ...body, updatedAt: new Date().toISOString() },
    deletedProjectIds,
  );

  // No dejar que un cliente sin Concluidos borre los del servidor.
  state = mergeKeepExistingProjects(state, existing, deletedProjectIds);
  // Tampoco borrar Extras que otro dispositivo aún no tiene en su snapshot.
  state = mergeKeepExistingExtras(state, existing);
  // Mover dataUrls pesados a /api/evidence/... (no borrarlos).
  state = externalizeProjectEvidence(state);

  if (!allowEmpty && !isMeaningfulState(state)) {
    if (isMeaningfulState(existing)) {
      throw new Error(
        'Se rechazó guardar un tablero vacío sobre datos existentes. Usa allowEmpty si es intencional.',
      );
    }
  }

  // Protección: no pisar un tablero rico con uno casi vacío.
  // Un borrado legítimo (tombstones nuevos que explican la baja) sí se permite.
  if (!allowEmpty && existing && wouldWipeProjects(state, existing)) {
    const existingDeleted = existing.deletedProjectIds || {};
    const newlyDeleted = Object.keys(deletedProjectIds).filter(
      (id) => !existingDeleted[id],
    );
    const existingIds = new Set(
      (existing.board?.projects || []).map((p) => p?.id).filter(Boolean),
    );
    const explainedByTombstones = newlyDeleted.some((id) => existingIds.has(id));
    if (!explainedByTombstones && newlyDeleted.length === 0) {
      throw new Error(
        'Se rechazó guardar: el estado nuevo borraría proyectos existentes. Usa allowEmpty si es intencional.',
      );
    }
  }

  const errors = [];

  if (databaseUrl()) {
    try {
      await saveStateToPostgres(state);
      if (blobToken()) {
        try {
          await saveStateToBlob(state);
        } catch (mirrorErr) {
          console.error('Blob mirror save failed:', mirrorErr?.message ?? mirrorErr);
        }
      }
      return state;
    } catch (error) {
      console.error('saveStateToPostgres failed, trying Supabase API:', error?.message ?? error);
      errors.push(error);
    }
  }

  if (hasSupabaseApi()) {
    try {
      await saveStateToSupabaseApi(state);
      return state;
    } catch (error) {
      console.error('saveStateToSupabaseApi failed:', error?.message ?? error);
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
