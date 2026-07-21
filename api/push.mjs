import { removeSubscription, saveSubscription, sendPush } from '../server/pushStore.mjs';

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

  const body = req.body ?? {};
  const action = body.action;

  try {
    if (action === 'subscribe') {
      const { subscription, userId, userName, employeeId } = body;
      if (!subscription?.endpoint) {
        res.status(400).json({ error: 'Suscripción inválida' });
        return;
      }
      await saveSubscription({ subscription, userId, userName, employeeId });
      res.status(200).json({ ok: true });
      return;
    }

    if (action === 'unsubscribe') {
      await removeSubscription(body.endpoint);
      res.status(200).json({ ok: true });
      return;
    }

    if (action === 'notify') {
      const { audience, employeeIds, excludeUserId, title, body: text, url, tag } = body;
      if (!title) {
        res.status(400).json({ error: 'Falta el título' });
        return;
      }
      const result = await sendPush({
        audience,
        employeeIds,
        excludeUserId,
        title,
        body: text,
        url,
        tag,
      });
      res.status(200).json(result);
      return;
    }

    res.status(400).json({ error: 'Acción desconocida' });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
  }
}
