import { addLibraryImage } from '../../server/mediaLibraryStore.mjs';

const MAX_BYTES = 8 * 1024 * 1024;

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

  const { id, name, mimeType, size, base64, uploadedBy, uploadedByName, width, height } = req.body ?? {};

  if (!id || !name || !mimeType || !base64 || !uploadedBy) {
    res.status(400).json({ error: 'Datos de imagen incompletos' });
    return;
  }

  if (!mimeType.startsWith('image/')) {
    res.status(400).json({ error: 'Solo se permiten imágenes' });
    return;
  }

  try {
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length > MAX_BYTES) {
      res.status(400).json({ error: 'La imagen no puede superar 8 MB' });
      return;
    }

    const item = {
      id,
      name,
      mimeType,
      size: size ?? buffer.length,
      uploadedBy,
      uploadedByName: uploadedByName ?? uploadedBy,
      uploadedAt: new Date().toISOString(),
      width: width ?? null,
      height: height ?? null,
    };

    const saved = await addLibraryImage(item, buffer);
    res.status(200).json({ ok: true, item: saved });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'No se pudo subir la imagen',
    });
  }
}
