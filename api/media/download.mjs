import { listLibraryImages } from '../../server/mediaLibraryStore.mjs';
import { resolveLibraryImageUrl } from '../../server/mediaApiFormat.mjs';

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
    const url = resolveLibraryImageUrl(item.url, origin);
    const fileRes = await fetch(url, { cache: 'no-store' });
    if (!fileRes.ok) {
      res.status(502).json({ error: 'No se pudo obtener el archivo' });
      return;
    }

    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const safeName = item.name.replace(/[^\w.\-() ]+/g, '_') || `imagen-${item.id}`;

    res.setHeader('Content-Type', item.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.status(200).send(buffer);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'No se pudo descargar la imagen',
    });
  }
}
