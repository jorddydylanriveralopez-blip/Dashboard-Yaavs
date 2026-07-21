import { listLibraryImages } from '../../server/mediaLibraryStore.mjs';
import { buildMediaCatalog } from '../../server/mediaApiFormat.mjs';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function requestOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] ?? 'https';
  const host = req.headers['x-forwarded-host'] ?? req.headers.host;
  if (!host) return '';
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  try {
    const items = await listLibraryImages();
    const catalog = buildMediaCatalog(items, requestOrigin(req));
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60');
    res.status(200).json(catalog);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'No se pudo cargar la biblioteca',
    });
  }
}
