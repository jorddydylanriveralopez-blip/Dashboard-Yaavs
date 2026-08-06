import { loadAppState, saveAppState } from '../server/appStateStore.mjs';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    try {
      const state = await loadAppState();
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const viewerId = String(
        url.searchParams.get('userId') || req.query?.userId || '',
      ).trim();
      const calendars = state.calendars || {};
      const busySlots = state.busySlots || {};
      // Agenda propia + Orlando (ocupado visible al equipo).
      const pick = (store, id) => (id && store[id] ? { [id]: store[id] } : {});
      const filtered = {
        ...state,
        calendars: {
          ...pick(calendars, viewerId),
          ...(calendars['u-orlando'] ? { 'u-orlando': calendars['u-orlando'] } : {}),
        },
        busySlots: {
          ...pick(busySlots, viewerId),
          ...(busySlots['u-orlando'] ? { 'u-orlando': busySlots['u-orlando'] } : {}),
        },
      };
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(filtered);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'No se pudo leer el estado',
      });
    }
    return;
  }

  if (req.method === 'PUT') {
    const body = req.body;
    if (!body?.board) {
      res.status(400).json({ error: 'Estado inválido' });
      return;
    }
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const allowEmpty =
        url.searchParams.get('allowEmpty') === '1' ||
        req.headers['x-allow-empty'] === '1';
      const saved = await saveAppState(body, { allowEmpty });
      res.status(200).json({ ok: true, updatedAt: saved.updatedAt });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar el estado';
      const status = message.includes('tablero vacío') ? 409 : 500;
      res.status(status).json({ error: message });
    }
    return;
  }

  res.status(405).json({ error: 'Método no permitido' });
}
