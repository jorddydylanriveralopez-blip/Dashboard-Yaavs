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

async function fetchTargets({ audience, employeeIds, userIds, excludeUserId }) {
  const rows = await sql`SELECT endpoint, subscription, user_id, employee_id FROM push_subscriptions`;
  const empFilter = Array.isArray(employeeIds) && employeeIds.length > 0;
  const userFilter = Array.isArray(userIds) && userIds.length > 0;

  return rows.filter((row) => {
    if (excludeUserId && row.user_id === excludeUserId) return false;

    // Si piden IDs concretos, solo esos (emp o user).
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
  if (!ensureVapid()) {
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
