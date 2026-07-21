import { removeLibraryImage } from '../../server/mediaLibraryStore.mjs';

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

  const { id } = req.body ?? {};
  if (!id) {
    res.status(400).json({ error: 'Falta el id de la imagen' });
    return;
  }

  try {
    const ok = await removeLibraryImage(id);
    if (!ok) {
      res.status(404).json({ error: 'Imagen no encontrada' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'No se pudo eliminar la imagen',
    });
  }
}
