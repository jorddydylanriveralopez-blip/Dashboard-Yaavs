import webpush from 'web-push';
import { databaseUrl, sql } from './db.mjs';

let vapidReady = false;

function ensureVapid() {
  if (vapidReady) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:marketing@yaavs.com.mx',
    publicKey,
    privateKey,
  );
  vapidReady = true;
  return true;
}

export async function saveSubscription({ subscription, userId, userName, employeeId }) {
  if (!subscription?.endpoint) throw new Error('Suscripción inválida');
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
  await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
}

async function fetchTargets({ audience, employeeIds, excludeUserId }) {
  const rows = await sql`SELECT endpoint, subscription, user_id, employee_id FROM push_subscriptions`;
  return rows.filter((row) => {
    if (excludeUserId && row.user_id === excludeUserId) return false;
    if (audience === 'employees' && Array.isArray(employeeIds) && employeeIds.length) {
      return employeeIds.includes(row.employee_id);
    }
    return true;
  });
}

/** Envía una notificación push a la audiencia indicada. */
export async function sendPush({
  audience = 'all',
  employeeIds,
  excludeUserId,
  title,
  body,
  url,
  tag,
}) {
  if (!ensureVapid()) {
    return { ok: false, error: 'VAPID no configurado', sent: 0 };
  }
  if (!databaseUrl()) {
    return { ok: false, error: 'Base de datos no configurada', sent: 0 };
  }

  const targets = await fetchTargets({ audience, employeeIds, excludeUserId });
  const payload = JSON.stringify({ title, body, url: url ?? '/', tag });

  let sent = 0;
  const stale = [];
  await Promise.all(
    targets.map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription, payload);
        sent += 1;
      } catch (err) {
        const status = err?.statusCode;
        if (status === 404 || status === 410) stale.push(row.endpoint);
      }
    }),
  );

  if (stale.length) {
    const sql = await getSql();
    await sql`DELETE FROM push_subscriptions WHERE endpoint = ANY(${stale})`;
  }

  return { ok: true, sent };
}
