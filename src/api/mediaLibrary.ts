import type { LibraryImage, MediaCatalogResponse } from '../types';
import { IMAGE_LIBRARY_CACHE_KEY } from '../constants';
import { readImageDimensions } from '../utils/imageDimensions';

export function apiBase(): string {
  const fromEnv = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

export function resolveLibraryImageUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }
  const base = apiBase();
  if (!base) return url;
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

export async function fetchLibraryImages(): Promise<LibraryImage[]> {
  const catalog = await fetchMediaCatalog();
  return catalog.items.map((item) => ({
    id: item.id,
    name: item.name,
    mimeType: item.mimeType,
    size: item.size,
    url: item.url,
    uploadedBy: item.uploadedBy,
    uploadedByName: item.uploadedByName,
    uploadedAt: item.uploadedAt,
    width: item.width,
    height: item.height,
  }));
}

export async function fetchMediaCatalog(): Promise<MediaCatalogResponse> {
  const base = apiBase();
  if (!base) {
    return {
      name: 'Yaavs Image CDN',
      version: '1',
      publicPage: null,
      listUrl: null,
      count: 0,
      updatedAt: new Date().toISOString(),
      items: [],
    };
  }

  try {
    const res = await fetch(`${base}/api/media/list`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const catalog = (await res.json()) as MediaCatalogResponse;
    try {
      localStorage.setItem(IMAGE_LIBRARY_CACHE_KEY, JSON.stringify(catalog.items));
    } catch {
      /* ignore quota */
    }
    return catalog;
  } catch {
    try {
      const raw = localStorage.getItem(IMAGE_LIBRARY_CACHE_KEY);
      if (raw) {
        const items = JSON.parse(raw) as MediaCatalogResponse['items'];
        return {
          name: 'Yaavs Image CDN',
          version: '1',
          publicPage: `${base}/almacen`,
          listUrl: `${base}/api/media/list`,
          count: items.length,
          updatedAt: new Date().toISOString(),
          items,
        };
      }
    } catch {
      /* ignore */
    }
    return {
      name: 'Yaavs Image CDN',
      version: '1',
      publicPage: `${base}/almacen`,
      listUrl: `${base}/api/media/list`,
      count: 0,
      updatedAt: new Date().toISOString(),
      items: [],
    };
  }
}

export async function uploadLibraryImage(input: {
  file: File;
  uploadedBy: string;
  uploadedByName: string;
}): Promise<LibraryImage> {
  const base = apiBase();
  if (!base) throw new Error('No hay conexión con el servidor');

  if (!input.file.type.startsWith('image/')) {
    throw new Error('Solo se permiten imágenes');
  }

  const base64 = await fileToBase64(input.file);
  const id = crypto.randomUUID();
  const dims = await readImageDimensions(input.file);

  const res = await fetch(`${base}/api/media/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      name: input.file.name,
      mimeType: input.file.type || 'image/png',
      size: input.file.size,
      base64,
      uploadedBy: input.uploadedBy,
      uploadedByName: input.uploadedByName,
      width: dims?.width ?? null,
      height: dims?.height ?? null,
    }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Error ${res.status}`);
  }

  const data = (await res.json()) as { item: LibraryImage };
  return {
    ...data.item,
    url: resolveLibraryImageUrl(data.item.url),
  };
}

export async function deleteLibraryImage(id: string): Promise<void> {
  const base = apiBase();
  if (!base) throw new Error('No hay conexión con el servidor');

  const res = await fetch(`${base}/api/media/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Error ${res.status}`);
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}
