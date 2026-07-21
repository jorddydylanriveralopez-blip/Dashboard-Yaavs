import {
  resolveReminderEmail,
  sendCalendarReminderEmail,
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

  res.status(200).json({ ok: true, to });
}
