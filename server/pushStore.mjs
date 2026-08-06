import webpush from 'web-push';
import { databaseUrl, sql } from './db.mjs';

const VAPID_DB_KEY = 'yaavs-vapid';

let vapidReady = false;
let vapidPublic = '';
let vapidLoadPromise = null;

function applyVapid(publicKey, privateKey, subject) {
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    subject || process.env.VAPID_SUBJECT || 'mailto:marketing@yaavs.com.mx',
    publicKey,
    privateKey,
  );
  vapidPublic = publicKey;
  vapidReady = true;
  return true;
}

async function saveVapidToDb(publicKey, privateKey) {
  if (!databaseUrl()) return;
  const json = JSON.stringify({
    publicKey,
    privateKey,
    subject: process.env.VAPID_SUBJECT || 'mailto:marketing@yaavs.com.mx',
    updatedAt: new Date().toISOString(),
  });
  try {
    await sql`
      INSERT INTO app_state (key, state, updated_at)
      VALUES (${VAPID_DB_KEY}, ${json}::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET state = ${json}::jsonb, updated_at = now()
    `;
  } catch (err) {
    console.warn('No se pudo guardar VAPID en DB:', err?.message ?? err);
  }
}

async function loadVapidFromDb() {
  if (!databaseUrl()) return null;
  try {
    const rows = await sql`SELECT state FROM app_state WHERE key = ${VAPID_DB_KEY} LIMIT 1`;
    const state = rows?.[0]?.state;
    if (!state) return null;
    const parsed = typeof state === 'string' ? JSON.parse(state) : state;
    if (parsed?.publicKey && parsed?.privateKey) return parsed;
  } catch (err) {
    console.warn('No se pudo leer VAPID de DB:', err?.message ?? err);
  }
  return null;
}

/** Carga o genera claves VAPID (env → DB → generar y persistir). */
export async function ensureVapidConfigured() {
  if (vapidReady && vapidPublic) return true;
  if (vapidLoadPromise) return vapidLoadPromise;

  vapidLoadPromise = (async () => {
    const envPub = (process.env.VAPID_PUBLIC_KEY || '').trim();
    const envPriv = (process.env.VAPID_PRIVATE_KEY || '').trim();
    if (envPub && envPriv && applyVapid(envPub, envPriv)) {
      // Persist for Hostinger rebuilds that lose env vars.
      await saveVapidToDb(envPub, envPriv);
      return true;
    }

    const fromDb = await loadVapidFromDb();
    if (fromDb && applyVapid(fromDb.publicKey, fromDb.privateKey, fromDb.subject)) {
      return true;
    }

    try {
      const generated = webpush.generateVAPIDKeys();
      if (applyVapid(generated.publicKey, generated.privateKey)) {
        await saveVapidToDb(generated.publicKey, generated.privateKey);
        console.log('VAPID generado y guardado en la base de datos');
        return true;
      }
    } catch (err) {
      console.warn('No se pudo generar VAPID:', err?.message ?? err);
    }
    return false;
  })();

  try {
    return await vapidLoadPromise;
  } finally {
    vapidLoadPromise = null;
  }
}

export async function getVapidPublicKey() {
  await ensureVapidConfigured();
  return vapidPublic || null;
}

export async function saveSubscription({ subscription, userId, userName, employeeId }) {
  if (!subscription?.endpoint) throw new Error('Suscripción inválida');
  if (!databaseUrl()) throw new Error('Base de datos no configurada');
  const json = JSON.stringify(subscription);
  await sql`
    INSERT INTO push_subscriptions (endpoint, subscription, user_id, user_name, employee_id, updated_at)
    VALUES (${subscription.endpoint}, ${json}::jsonb, ${userId ?? null}, ${userName ?? null}, ${employeeId ?? null}, now())
    ON CONFLICT (endpoint) DO UPDATE SET
      subscription = ${json}::jsonb,
      user_id = ${userId ?? null},
      user_name = ${userName ?? null},
      employee_id = ${employeeId ?? null},
      updated_at = now()
  `;
}

export async function removeSubscription(endpoint) {
  if (!endpoint) return;
  if (!databaseUrl()) return;
  await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
}

async function fetchTargets({ audience, employeeIds, userIds, excludeUserId }) {
  const rows = await sql`SELECT endpoint, subscription, user_id, employee_id FROM push_subscriptions`;
  const empFilter = Array.isArray(employeeIds) && employeeIds.length > 0;
  const userFilter = Array.isArray(userIds) && userIds.length > 0;

  return rows.filter((row) => {
    if (excludeUserId && row.user_id === excludeUserId) return false;

    if (empFilter || userFilter) {
      const matchEmp = empFilter && employeeIds.includes(row.employee_id);
      const matchUser = userFilter && userIds.includes(row.user_id);
      return Boolean(matchEmp || matchUser);
    }

    if (audience === 'employees') {
      return Boolean(row.employee_id);
    }

    return true;
  });
}

/** Envía una notificación push a la audiencia indicada. */
export async function sendPush({
  audience = 'all',
  employeeIds,
  userIds,
  excludeUserId,
  title,
  body,
  url,
  tag,
}) {
  if (!(await ensureVapidConfigured())) {
    return { ok: false, error: 'VAPID no configurado', sent: 0 };
  }
  if (!databaseUrl()) {
    return { ok: false, error: 'Base de datos no configurada', sent: 0 };
  }

  const targets = await fetchTargets({ audience, employeeIds, userIds, excludeUserId });
  const payload = JSON.stringify({ title, body, url: url ?? '/', tag });

  let sent = 0;
  const stale = [];
  await Promise.all(
    targets.map(async (row) => {
      try {
        const sub =
          typeof row.subscription === 'string'
            ? JSON.parse(row.subscription)
            : row.subscription;
        await webpush.sendNotification(sub, payload);
        sent += 1;
      } catch (err) {
        const status = err?.statusCode;
        if (status === 404 || status === 410) stale.push(row.endpoint);
      }
    }),
  );

  if (stale.length) {
    await sql`DELETE FROM push_subscriptions WHERE endpoint = ANY(${stale})`;
  }

  return { ok: true, sent, targeted: targets.length };
}
