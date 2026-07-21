import { saveUserCalendar } from '../../server/calendarStore.mjs';

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

  const { userId, userName, email, events } = req.body ?? {};
  if (!userId || !Array.isArray(events)) {
    res.status(400).json({ error: 'Estado de agenda inválido' });
    return;
  }

  try {
    const saved = await saveUserCalendar(userId, {
      userName: userName ?? '',
      email: email ?? '',
      events,
    });
    res.status(200).json({ ok: true, updatedAt: saved.updatedAt });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'No se pudo guardar la agenda',
    });
  }
}
