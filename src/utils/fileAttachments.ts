import type { FileAttachment } from '../types';
import { registerPendingBlob } from './attachmentStore';

/** 30 GB por archivo (límite solicitado; archivos enormes pueden fallar en el navegador). */
export const MAX_ATTACHMENT_BYTES = 30 * 1024 * 1024 * 1024;

/** Por encima de esto se guarda como blob (videos/imágenes grandes). */
export const INLINE_ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;

/** Sin tope fijo de cantidad; a partir de 6 se muestra vista en lista. */
export const LIST_LAYOUT_MIN_COUNT = 6;

/** Se permite seleccionar cualquier tipo de archivo como evidencia. */
export const ATTACHMENT_ACCEPT = '*/*';

/** Máximo de archivos por registro de avance de proyecto. */
export const MAX_PROGRESS_FILES = 12;

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|heic|heif|bmp|svg|avif)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|avi|mkv)$/i;

export function guessMimeType(file: File): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (IMAGE_EXT.test(name)) return 'image/png';
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (VIDEO_EXT.test(name)) return 'video/mp4';
  return 'application/octet-stream';
}

export function isAllowedFile(file: File): boolean {
  return file.size <= MAX_ATTACHMENT_BYTES;
}

export function isImageAttachment(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function isVideoAttachment(mimeType: string): boolean {
  return mimeType.startsWith('video/');
}

export function isPdfAttachment(mimeType: string): boolean {
  return mimeType === 'application/pdf' || mimeType.endsWith('/pdf');
}

function readFileAsArrayBuffer(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
      }
    };
    reader.onload = () => {
      const result = reader.result;
      if (!(result instanceof ArrayBuffer)) {
        reject(new Error(`No se pudo leer «${file.name}».`));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error(`No se pudo leer «${file.name}».`));
    onProgress?.(0);
    reader.readAsArrayBuffer(file);
  });
}

function readFileAsDataUrl(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
      }
    };
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== 'string') {
        reject(new Error(`No se pudo leer «${file.name}».`));
        return;
      }
      resolve(dataUrl);
    };
    reader.onerror = () => reject(new Error(`No se pudo leer «${file.name}».`));
    onProgress?.(0);
    reader.readAsDataURL(file);
  });
}

export async function readFileAsAttachment(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<FileAttachment> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(
      `«${file.name}» pesa ${formatAttachmentSize(file.size)}. Máximo ${formatAttachmentSize(MAX_ATTACHMENT_BYTES)} por archivo.`,
    );
  }

  const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const mimeType = guessMimeType(file);
  const createdAt = new Date().toISOString();

  if (file.size > INLINE_ATTACHMENT_MAX_BYTES) {
    const buffer = await readFileAsArrayBuffer(file, onProgress);
    const blob = new Blob([buffer], { type: mimeType });
    registerPendingBlob(id, blob);
    return {
      id,
      name: file.name,
      mimeType,
      size: file.size,
      dataUrl: URL.createObjectURL(blob),
      blobStored: true,
      createdAt,
    };
  }

  const dataUrl = await readFileAsDataUrl(file, onProgress);
  return {
    id,
    name: file.name,
    mimeType,
    size: file.size,
    dataUrl,
    createdAt,
  };
}

export function cloneAttachments(attachments: FileAttachment[]): FileAttachment[] {
  const now = Date.now();
  return attachments.map((a, i) => ({
    ...a,
    id: `att-${now}-${i}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  }));
}

export function totalAttachmentsBytes(attachments: FileAttachment[]): number {
  return attachments.reduce((sum, a) => sum + a.size, 0);
}

export function attachmentsSummary(attachments: FileAttachment[]): string {
  const n = attachments.length;
  if (n === 0) return 'Sin archivos adjuntos';
  const names = attachments.map((a) => a.name).join(', ');
  const size = formatAttachmentSize(totalAttachmentsBytes(attachments));
  if (n === 1) return `1 archivo adjunto (${size}): ${names}`;
  return `${n} archivos adjuntos (${size}): ${names}`;
}
