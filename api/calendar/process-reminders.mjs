import {
  eventsDueForReminder,
  resolveReminderEmail,
  sendCalendarReminderEmail,
} from '../../server/calendarReminders.mjs';
import { loadUserCalendar, saveUserCalendar } from '../../server/calendarStore.mjs';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization ?? '';
    if (auth !== `Bearer ${cronSecret}`) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }
  }

  const sent = [];
  const errors = [];

  try {
    const userIds = ['u-orlando'];
    for (const userId of userIds) {
      const store = await loadUserCalendar(userId);
      if (!store?.events?.length) continue;

      const email = resolveReminderEmail(userId, store.email);
      if (!email) continue;

      const due = eventsDueForReminder(store.events);
      if (due.length === 0) continue;

      let changed = false;
      for (const event of due) {
        const result = await sendCalendarReminderEmail({
          to: email,
          userName: store.userName ?? 'Orlando',
          event,
        });
        if (result.ok) {
          event.emailRemindedAt = new Date().toISOString();
          sent.push({ userId, eventId: event.id, title: event.title });
          changed = true;
        } else {
          errors.push({ userId, eventId: event.id, error: result.error });
        }
      }

      if (changed) {
        await saveUserCalendar(userId, store);
      }
    }

    res.status(200).json({ ok: true, sent, errors });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Error procesando recordatorios',
    });
  }
}
