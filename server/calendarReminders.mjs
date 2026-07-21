/** Correos para recordatorios de agenda por usuario. */
export const CALENDAR_EMAIL_BY_USER = {
  'u-orlando': 'orlando.villagomez@yaavs.com.mx',
};

export function resolveReminderEmail(userId, overrideEmail) {
  const trimmed = (overrideEmail ?? '').trim();
  if (trimmed) return trimmed;
  return CALENDAR_EMAIL_BY_USER[userId] ?? null;
}

export function parseEventDateTime(date, time) {
  return new Date(`${date}T${time}:00`);
}

export function formatEventWhen(date, time) {
  const d = parseEventDateTime(date, time);
  return d.toLocaleString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function eventsDueForReminder(events, now = new Date()) {
  const due = [];
  const nowMs = now.getTime();
  for (const ev of events ?? []) {
    if (ev.done || ev.reminderMinutes <= 0 || ev.emailRemindedAt) continue;
    const start = parseEventDateTime(ev.date, ev.time).getTime();
    if (Number.isNaN(start)) continue;
    const remindAt = start - ev.reminderMinutes * 60_000;
    if (nowMs >= remindAt && nowMs < start + 60_000) {
      due.push(ev);
    }
  }
  return due;
}

export function reminderLabel(minutes) {
  if (minutes >= 1440) return '1 día antes';
  if (minutes >= 60) return `${Math.round(minutes / 60)} hora(s) antes`;
  return `${minutes} min antes`;
}

export function buildReminderEmailHtml({ userName, event }) {
  const when = formatEventWhen(event.date, event.time);
  const notes = event.notes?.trim();
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Segoe UI,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:16px;border:1px solid #e6eaf2;overflow:hidden;">
        <tr><td style="padding:22px 24px;background:linear-gradient(135deg,#2f4eb8,#4f6fe8);color:#fff;">
          <div style="font-size:12px;opacity:.9;text-transform:uppercase;letter-spacing:.06em;">Yaavs — Agenda</div>
          <h1 style="margin:8px 0 0;font-size:20px;">Recordatorio de pendiente</h1>
        </td></tr>
        <tr><td style="padding:24px;color:#1f2a44;line-height:1.5;">
          <p style="margin:0 0 12px;">Hola <strong>${escapeHtml(userName)}</strong>,</p>
          <p style="margin:0 0 16px;">Te recordamos tu pendiente programado (${reminderLabel(event.reminderMinutes)}):</p>
          <div style="padding:14px 16px;border-radius:12px;background:#f3f6ff;border:1px solid #d8e2ff;">
            <div style="font-size:18px;font-weight:700;margin-bottom:6px;">${escapeHtml(event.title)}</div>
            <div style="font-size:14px;color:#4a5d8a;">📅 ${escapeHtml(when)}</div>
            ${notes ? `<div style="margin-top:10px;font-size:14px;color:#5c6b88;">${escapeHtml(notes)}</div>` : ''}
          </div>
          <p style="margin:16px 0 0;font-size:13px;color:#6b7a99;">Puedes marcarlo como hecho en tu agenda de Yaavs cuando lo completes.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendCalendarReminderEmail({ to, userName, event }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY no configurada en el servidor' };
  }

  const from = process.env.RESEND_FROM || 'Yaavs Agenda <onboarding@resend.dev>';
  const subject = `Recordatorio: ${event.title} — Yaavs`;
  const html = buildReminderEmailHtml({ userName, event });

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: body || `Resend ${res.status}` };
  }

  return { ok: true };
}
