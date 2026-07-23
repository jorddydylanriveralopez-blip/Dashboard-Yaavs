import {
  resolveReminderEmail,
  sendAgendaAlertEmail,
} from '../../server/calendarReminders.mjs';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

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

  res.status(200).json({ ok: true, to });
}
