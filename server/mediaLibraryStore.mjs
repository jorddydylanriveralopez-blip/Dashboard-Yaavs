import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { probeImageDimensions } from './mediaApiFormat.mjs';

// import.meta.url puede romperse al empaquetar (Netlify/esbuild). En serverless
// no se usa almacenamiento local, así que se protege con fallbacks nulos.
let LOCAL_DIR = null;
let LOCAL_FILES = null;
let LOCAL_INDEX = null;
try {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  LOCAL_DIR = path.join(__dirname, 'data', 'media-library');
  LOCAL_FILES = path.join(LOCAL_DIR, 'files');
  LOCAL_INDEX = path.join(LOCAL_DIR, 'index.json');
} catch {
  LOCAL_DIR = null;
}
const BLOB_INDEX_PATH = 'media-library/index.json';
const BLOB_PREFIX = 'media-library/files/';

function isServerless() {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.NETLIFY,
  );
}

function canUseLocalStorage() {
  return !isServerless() && Boolean(LOCAL_DIR);
}

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN || null;
}

function blobOptions(extra = {}) {
  const token = blobToken();
  return token ? { ...extra, token } : extra;
}

function ensureLocalDirs() {
  if (!canUseLocalStorage()) {
    throw new Error(
      'El almacén de imágenes requiere Vercel Blob en producción. Conecta un Blob Store al proyecto en Vercel.',
    );
  }
  fs.mkdirSync(LOCAL_FILES, { recursive: true });
}

function readLocalIndex() {
  if (!canUseLocalStorage()) return [];
  try {
    if (fs.existsSync(LOCAL_INDEX)) {
      const data = JSON.parse(fs.readFileSync(LOCAL_INDEX, 'utf8'));
      return Array.isArray(data.items) ? data.items : [];
    }
  } catch {
    /* ignore */
  }
  return [];
}

function writeLocalIndex(items) {
  ensureLocalDirs();
  fs.writeFileSync(
    LOCAL_INDEX,
    JSON.stringify({ items, updatedAt: new Date().toISOString() }, null, 2),
  );
}

function extForMime(mimeType, name = '') {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'jpg';
  if (lower.endsWith('.webp')) return 'webp';
  if (lower.endsWith('.gif')) return 'gif';
  if (lower.endsWith('.svg')) return 'svg';
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/svg+xml') return 'svg';
  return 'bin';
}

async function loadIndexFromBlob() {
  try {
    const { list } = await import('@vercel/blob');
    const { blobs } = await list(blobOptions({ prefix: BLOB_INDEX_PATH }));
    const match = blobs.find((b) => b.pathname === BLOB_INDEX_PATH);
    if (!match?.url) return isServerless() ? [] : null;

    const res = await fetch(match.url, { cache: 'no-store' });
    if (!res.ok) return isServerless() ? [] : null;
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return isServerless() ? [] : null;
  }
}

async function saveIndexToBlob(items) {
  try {
    const { put } = await import('@vercel/blob');
    await put(
      BLOB_INDEX_PATH,
      JSON.stringify({ items, updatedAt: new Date().toISOString() }),
      blobOptions({
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      }),
    );
    return true;
  } catch (err) {
    if (isServerless()) {
      throw new Error(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el índice de la biblioteca en Vercel Blob.',
      );
    }
    return false;
  }
}

async function uploadFileToBlob(id, mimeType, buffer, name) {
  const ext = extForMime(mimeType, name);
  try {
    const { put } = await import('@vercel/blob');
    const blob = await put(`${BLOB_PREFIX}${id}.${ext}`, buffer, blobOptions({
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: mimeType,
    }));
    return blob.url;
  } catch (err) {
    if (isServerless()) {
      throw new Error(
        err instanceof Error
          ? err.message
          : 'No se pudo subir la imagen a Vercel Blob. Verifica que el Blob Store esté conectado.',
      );
    }
    return null;
  }
}

async function deleteFileFromBlob(id, mimeType, name) {
  const ext = extForMime(mimeType, name);
  try {
    const { del } = await import('@vercel/blob');
    await del(`${BLOB_PREFIX}${id}.${ext}`, blobOptions());
    return true;
  } catch {
    return isServerless();
  }
}

export async function listLibraryImages() {
  const fromBlob = await loadIndexFromBlob();
  if (fromBlob !== null) {
    return fromBlob.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }
  return readLocalIndex().sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function addLibraryImage(item, buffer) {
  const items = await listLibraryImages();
  const dims =
    item.width && item.height
      ? { width: item.width, height: item.height }
      : probeImageDimensions(buffer, item.mimeType);
  const withDims = {
    ...item,
    width: dims.width ?? item.width ?? null,
    height: dims.height ?? item.height ?? null,
  };

  const blobUrl = await uploadFileToBlob(withDims.id, withDims.mimeType, buffer, withDims.name);
  if (blobUrl) {
    const stored = { ...withDims, url: blobUrl };
    const saved = await saveIndexToBlob([stored, ...items.filter((i) => i.id !== withDims.id)]);
    if (!saved && isServerless()) {
      throw new Error('No se pudo actualizar la biblioteca en la nube.');
    }
    return stored;
  }

  if (!canUseLocalStorage()) {
    throw new Error(
      'El almacén de imágenes no está disponible. Conecta Vercel Blob al proyecto en el panel de Vercel.',
    );
  }

  ensureLocalDirs();
  const ext = extForMime(withDims.mimeType, withDims.name);
  const filePath = path.join(LOCAL_FILES, `${withDims.id}.${ext}`);
  fs.writeFileSync(filePath, buffer);
  const stored = { ...withDims, url: `/api/media/file/${withDims.id}` };
  writeLocalIndex([stored, ...items.filter((i) => i.id !== withDims.id)]);
  return stored;
}

export async function removeLibraryImage(id) {
  const items = await listLibraryImages();
  const target = items.find((i) => i.id === id);
  if (!target) return false;

  const next = items.filter((i) => i.id !== id);

  if (isServerless() || blobToken()) {
    await deleteFileFromBlob(id, target.mimeType, target.name);
    const saved = await saveIndexToBlob(next);
    return saved || isServerless();
  }

  const ext = extForMime(target.mimeType, target.name);
  const filePath = path.join(LOCAL_FILES, `${id}.${ext}`);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
  writeLocalIndex(next);
  return true;
}

export function readLocalLibraryFile(id) {
  if (!canUseLocalStorage()) return null;
  const items = readLocalIndex();
  const target = items.find((i) => i.id === id);
  if (!target) return null;

  const ext = extForMime(target.mimeType, target.name);
  const filePath = path.join(LOCAL_FILES, `${id}.${ext}`);
  if (!fs.existsSync(filePath)) return null;

  return {
    buffer: fs.readFileSync(filePath),
    mimeType: target.mimeType,
    name: target.name,
  };
}
