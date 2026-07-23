import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let EVIDENCE_DIR = null;
try {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  EVIDENCE_DIR = path.join(dir, 'data', 'evidence');
} catch {
  EVIDENCE_DIR = null;
}

const MAX_INLINE_DATA_URL = 12_000;

function ensureDir() {
  if (!EVIDENCE_DIR) return false;
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  return true;
}

function extFor(mimeType = '', name = '') {
  const lower = String(name || '').toLowerCase();
  if (lower.endsWith('.png')) return 'png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'jpg';
  if (lower.endsWith('.webp')) return 'webp';
  if (lower.endsWith('.gif')) return 'gif';
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.pptx')) return 'pptx';
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'application/pdf') return 'pdf';
  if (String(mimeType).includes('presentation')) return 'pptx';
  return 'bin';
}

function parseDataUrl(dataUrl) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  const mime = m[1] || 'application/octet-stream';
  const isB64 = Boolean(m[2]);
  const data = m[3];
  const buffer = isB64
    ? Buffer.from(data, 'base64')
    : Buffer.from(decodeURIComponent(data), 'utf8');
  return { mime, buffer };
}

function safeId(value) {
  return String(value || 'file')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);
}

function hasUsableUrl(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl) return false;
  return (
    dataUrl.startsWith('http://') ||
    dataUrl.startsWith('https://') ||
    dataUrl.startsWith('/api/evidence/') ||
    dataUrl.startsWith('/evidence/') ||
    (dataUrl.startsWith('data:') && dataUrl.length > 64)
  );
}

/**
 * Guarda un data URL pesado en disco y devuelve URL pública relativa.
 */
export function persistEvidenceDataUrl(file, hintId) {
  if (!ensureDir()) return file;
  const dataUrl = file?.dataUrl;
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return file;
  if (dataUrl.length <= MAX_INLINE_DATA_URL) return file;

  const parsed = parseDataUrl(dataUrl);
  if (!parsed?.buffer?.length) return file;

  const mime = file.mimeType || parsed.mime || 'application/octet-stream';
  const id = safeId(file.id || hintId || `ev-${Date.now()}`);
  const ext = extFor(mime, file.name);
  const filename = `${id}.${ext}`;
  const full = path.join(EVIDENCE_DIR, filename);
  try {
    fs.writeFileSync(full, parsed.buffer);
  } catch (error) {
    console.error('persistEvidenceDataUrl failed:', error?.message ?? error);
    return file;
  }

  return {
    ...file,
    mimeType: mime,
    size: file.size || parsed.buffer.length,
    dataUrl: `/api/evidence/${filename}`,
    blobStored: false,
  };
}

function externalizeFile(file, hintId) {
  if (!file || typeof file !== 'object') return file;
  const dataUrl = file.dataUrl;
  if (typeof dataUrl === 'string' && dataUrl.startsWith('data:') && dataUrl.length > MAX_INLINE_DATA_URL) {
    return persistEvidenceDataUrl(file, hintId);
  }
  return file;
}

/**
 * Convierte dataUrls grandes de proyectos a /api/evidence/... para no inflar el sync.
 */
export function externalizeProjectEvidence(state) {
  const projects = Array.isArray(state?.board?.projects) ? state.board.projects : [];
  if (!projects.length) return state;

  return {
    ...state,
    board: {
      ...state.board,
      projects: projects.map((p) => {
        if (!p || typeof p !== 'object') return p;
        const next = { ...p };
        if (Array.isArray(p.attachments)) {
          next.attachments = p.attachments.map((f, i) =>
            externalizeFile(f, `${p.id}-att-${i}`),
          );
          next.attachmentCount = p.attachments.length;
        }
        if (Array.isArray(p.progressUpdates)) {
          next.progressUpdates = p.progressUpdates.map((up) => ({
            ...up,
            files: Array.isArray(up.files)
              ? up.files.map((f, i) => externalizeFile(f, `${up.id || p.id}-f-${i}`))
              : up.files,
            images: Array.isArray(up.images)
              ? up.images.map((img, i) => {
                  const asFile = {
                    id: `${up.id || p.id}-img-${i}`,
                    name: img?.name || `evidencia-${i + 1}.jpg`,
                    mimeType: 'image/jpeg',
                    size: typeof img?.dataUrl === 'string' ? img.dataUrl.length : 0,
                    dataUrl: img?.dataUrl,
                    createdAt: up.createdAt,
                  };
                  const saved = externalizeFile(asFile, asFile.id);
                  return { name: saved.name, dataUrl: saved.dataUrl };
                })
              : up.images,
          }));
        }
        return next;
      }),
    },
  };
}

/**
 * Si el cliente manda stubs vacíos, conserva evidencias ya externalizadas del servidor.
 */
export function mergeProgressUpdatesKeepEvidence(incoming, existing) {
  const incomingList = Array.isArray(incoming) ? incoming : [];
  const existingList = Array.isArray(existing) ? existing : [];
  if (!incomingList.length) return existingList.length ? existingList : incomingList;
  if (!existingList.length) return incomingList;

  const byId = new Map(existingList.filter((u) => u?.id).map((u) => [u.id, u]));
  return incomingList.map((up) => {
    const prev = up?.id ? byId.get(up.id) : null;
    if (!prev) return up;

    const prevFiles = Array.isArray(prev.files) ? prev.files : [];
    const nextFiles = Array.isArray(up.files) ? up.files : [];
    const files =
      nextFiles.length === 0
        ? prevFiles
        : nextFiles.map((f, i) => {
            if (hasUsableUrl(f?.dataUrl)) return f;
            const match =
              prevFiles.find((pf) => pf?.id && f?.id && pf.id === f.id) || prevFiles[i];
            return hasUsableUrl(match?.dataUrl) ? { ...f, ...match } : f;
          });

    const prevImages = Array.isArray(prev.images) ? prev.images : [];
    const nextImages = Array.isArray(up.images) ? up.images : [];
    const images =
      nextImages.length === 0
        ? prevImages
        : nextImages.map((img, i) => {
            if (hasUsableUrl(img?.dataUrl)) return img;
            const match = prevImages[i];
            return hasUsableUrl(match?.dataUrl) ? { ...img, ...match } : img;
          });

    return { ...prev, ...up, files, images };
  });
}

export function readEvidenceFile(filename) {
  if (!EVIDENCE_DIR || !filename) return null;
  const safe = path.basename(filename);
  if (safe !== filename || safe.includes('..')) return null;
  const full = path.join(EVIDENCE_DIR, safe);
  if (!fs.existsSync(full)) return null;
  const buffer = fs.readFileSync(full);
  const ext = path.extname(safe).toLowerCase();
  const mime =
    ext === '.png'
      ? 'image/png'
      : ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.webp'
          ? 'image/webp'
          : ext === '.gif'
            ? 'image/gif'
            : ext === '.pdf'
              ? 'application/pdf'
              : ext === '.pptx'
                ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                : 'application/octet-stream';
  return { buffer, mimeType: mime, filename: safe };
}
