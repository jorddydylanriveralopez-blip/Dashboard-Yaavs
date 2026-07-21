import { listLibraryImages } from '../../server/mediaLibraryStore.mjs';
import { enrichLibraryItem, resolveLibraryImageUrl } from '../../server/mediaApiFormat.mjs';

function requestOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] ?? 'https';
  const host = req.headers['x-forwarded-host'] ?? req.headers.host;
  if (!host) return '';
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const id = typeof req.query?.id === 'string' ? req.query.id : '';
  if (!id) {
    res.status(400).json({ error: 'Falta el parámetro id' });
    return;
  }

  try {
    const items = await listLibraryImages();
    const item = items.find((i) => i.id === id);
    if (!item) {
      res.status(404).json({ error: 'Imagen no encontrada' });
      return;
    }
    const origin = requestOrigin(req);
    const resolved = { ...item, url: resolveLibraryImageUrl(item.url, origin) };
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120');
    res.status(200).json(enrichLibraryItem(resolved, origin));
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'No se pudo cargar la imagen',
    });
  }
}
