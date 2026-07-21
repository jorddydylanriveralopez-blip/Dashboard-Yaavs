import { getGaReport } from '../../server/gaReport.mjs';
import { fetchMetaCampaigns, isMetaConfigured } from '../../server/metaAdsStore.mjs';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    // Meta Ads campaigns (mismo endpoint para no superar el límite Hobby de funciones).
    if (req.method === 'POST') {
      const body = req.body ?? {};
      if (body.action === 'meta-status') {
        res.status(200).json({ ok: true, configured: isMetaConfigured() });
        return;
      }
      if (body.action === 'meta-campaigns' || body.source === 'meta') {
        const result = await fetchMetaCampaigns({
          since: body.since,
          until: body.until,
          days: body.days,
        });
        res.status(200).json(result);
        return;
      }
      res.status(400).json({ error: 'Acción desconocida' });
      return;
    }

    if (req.method === 'GET') {
      const source = typeof req.query?.source === 'string' ? req.query.source : '';
      if (source === 'meta') {
        const days = req.query?.days ? Number(req.query.days) : undefined;
        const result = await fetchMetaCampaigns({
          since: req.query?.since,
          until: req.query?.until,
          days: Number.isFinite(days) ? days : undefined,
        });
        res.status(200).json(result);
        return;
      }

      const monthKey =
        typeof req.query?.month === 'string'
          ? req.query.month
          : new Date().toISOString().slice(0, 7);
      const report = await getGaReport(monthKey);
      res.status(200).json(report);
      return;
    }

    res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    res.status(500).json({
      ok: false,
      configured: isMetaConfigured(),
      error: error instanceof Error ? error.message : 'Error al consultar analytics',
      campaigns: [],
      summary: null,
    });
  }
}
