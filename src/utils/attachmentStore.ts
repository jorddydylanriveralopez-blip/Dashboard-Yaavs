import type { FileAttachment } from '../types';

const DB_NAME = 'yaavs-board-attachments';
const DB_VERSION = 2;
const STORE = 'files';
const BLOB_STORE = 'blobs';
const LS_KEY = 'yaavs-attachment-backup-v1';
/** Solo copia de respaldo en localStorage si el JSON es pequeño (evita fallos con PNG grandes). */
const LS_BACKUP_MAX_BYTES = 800_000;

type Kind = 'project' | 'assignment';

/** Caché en memoria para la sesión actual (siempre muestra lo subido). */
const memoryCache = new Map<string, FileAttachment[]>();
/** Blobs recién leídos, pendientes de escribir en IndexedDB. */
const pendingBlobs = new Map<string, Blob>();

export function registerPendingBlob(id: string, blob: Blob): void {
  pendingBlobs.set(id, blob);
}

function storageKey(kind: Kind, id: string): string {
  return `${kind}:${id}`;
}

function readLsBackup(): Record<string, FileAttachment[]> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, FileAttachment[]>;
  } catch {
    return {};
  }
}

function writeLsBackup(map: Record<string, FileAttachment[]>): void {
  const json = JSON.stringify(map);
  if (json.length > LS_BACKUP_MAX_BYTES) return;
  try {
    localStorage.setItem(LS_KEY, json);
  } catch {
    /* ignore quota */
  }
}

function lsGet(key: string): FileAttachment[] {
  return readLsBackup()[key] ?? [];
}

function lsSet(key: string, value: FileAttachment[]): void {
  const map = readLsBackup();
  if (value.length === 0) {
    delete map[key];
  } else {
    map[key] = value;
  }
  writeLsBackup(map);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no está disponible en este navegador.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('No se pudo abrir almacenamiento'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE);
      }
    };
  });
}

async function idbGet(key: string): Promise<FileAttachment[] | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as FileAttachment[] | undefined);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function idbSet(key: string, value: FileAttachment[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = value.length === 0 ? store.delete(key) : store.put(value, key);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Error al escribir en IndexedDB'));
    };
  });
}

async function idbGetBlob(id: string): Promise<Blob | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readonly');
    const store = tx.objectStore(BLOB_STORE);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function idbSetBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readwrite');
    const store = tx.objectStore(BLOB_STORE);
    const req = store.put(blob, id);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Error al guardar archivo'));
    };
  });
}

async function idbDeleteBlobs(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readwrite');
    const store = tx.objectStore(BLOB_STORE);
    for (const id of ids) store.delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

function stripForPersistence(attachments: FileAttachment[]): FileAttachment[] {
  return attachments.map((a) => {
    if (!a.blobStored) return a;
    return { ...a, dataUrl: '' };
  });
}

async function hydrateBlobUrls(attachments: FileAttachment[]): Promise<FileAttachment[]> {
  const out: FileAttachment[] = [];
  for (const a of attachments) {
    if (!a.blobStored) {
      out.push(a);
      continue;
    }
    if (a.dataUrl.startsWith('blob:')) {
      out.push(a);
      continue;
    }
    const pending = pendingBlobs.get(a.id);
    const blob = pending ?? (await idbGetBlob(a.id));
    if (!blob) {
      out.push(a);
      continue;
    }
    out.push({ ...a, dataUrl: URL.createObjectURL(blob) });
  }
  return out;
}

async function persistBlobs(attachments: FileAttachment[]): Promise<void> {
  for (const a of attachments) {
    if (!a.blobStored) continue;
    const pending = pendingBlobs.get(a.id);
    if (pending) {
      await idbSetBlob(a.id, pending);
      pendingBlobs.delete(a.id);
      continue;
    }
    if (a.dataUrl.startsWith('blob:')) {
      try {
        const res = await fetch(a.dataUrl);
        const blob = await res.blob();
        await idbSetBlob(a.id, blob);
      } catch {
        /* sin blob accesible */
      }
    }
  }
}

async function load(kind: Kind, id: string): Promise<FileAttachment[]> {
  const key = storageKey(kind, id);
  const cached = memoryCache.get(key);
  if (cached?.length) return cached;

  try {
    const fromDb = await idbGet(key);
    if (fromDb) {
      const hydrated = await hydrateBlobUrls(fromDb);
      memoryCache.set(key, hydrated);
      return hydrated;
    }
  } catch {
    /* fallback */
  }

  const fromLs = lsGet(key);
  if (fromLs.length) {
    const hydrated = await hydrateBlobUrls(fromLs);
    memoryCache.set(key, hydrated);
    return hydrated;
  }
  return [];
}

async function save(kind: Kind, id: string, attachments: FileAttachment[]): Promise<void> {
  const key = storageKey(kind, id);
  memoryCache.set(key, attachments);

  const toStore = stripForPersistence(attachments);

  try {
    await persistBlobs(attachments);
    await idbSet(key, toStore);
  } catch (err) {
    memoryCache.set(key, attachments);
    throw new Error(
      `No se pudo guardar en el navegador: ${err instanceof Error ? err.message : 'espacio insuficiente'}. La vista previa sigue en esta sesión.`,
      { cause: err },
    );
  }

  try {
    const json = JSON.stringify(toStore);
    if (json.length <= LS_BACKUP_MAX_BYTES) {
      lsSet(key, toStore);
    }
  } catch {
    /* respaldo opcional */
  }
}

export function loadProjectAttachments(projectId: string): Promise<FileAttachment[]> {
  return load('project', projectId);
}

export function saveProjectAttachments(
  projectId: string,
  attachments: FileAttachment[],
): Promise<void> {
  return save('project', projectId, attachments);
}

export function loadAssignmentAttachments(assignmentId: string): Promise<FileAttachment[]> {
  return load('assignment', assignmentId);
}

export function saveAssignmentAttachments(
  assignmentId: string,
  attachments: FileAttachment[],
): Promise<void> {
  return save('assignment', assignmentId, attachments);
}

function proofKey(projectId: string): string {
  return `proof:project:${projectId}`;
}

export async function loadProjectCompletionProof(
  projectId: string,
): Promise<FileAttachment | null> {
  const key = proofKey(projectId);
  const cached = memoryCache.get(key);
  if (cached?.[0]) return cached[0];

  try {
    const fromDb = await idbGet(key);
    if (fromDb?.[0]) {
      const hydrated = await hydrateBlobUrls(fromDb);
      memoryCache.set(key, hydrated);
      return hydrated[0] ?? null;
    }
  } catch {
    /* fallback */
  }

  const fromLs = lsGet(key);
  if (fromLs[0]) {
    const hydrated = await hydrateBlobUrls(fromLs);
    memoryCache.set(key, hydrated);
    return hydrated[0] ?? null;
  }
  return null;
}

export async function saveProjectCompletionProof(
  projectId: string,
  proof: FileAttachment,
): Promise<void> {
  const key = proofKey(projectId);
  const list = [proof];
  memoryCache.set(key, list);

  const toStore = stripForPersistence(list);
  await persistBlobs(list);
  await idbSet(key, toStore);

  try {
    const json = JSON.stringify(toStore);
    if (json.length <= LS_BACKUP_MAX_BYTES) lsSet(key, toStore);
  } catch {
    /* ignore */
  }
}

export async function deleteProjectCompletionProof(projectId: string): Promise<void> {
  const key = proofKey(projectId);
  const existing = memoryCache.get(key)?.[0] ?? (await loadProjectCompletionProof(projectId));
  if (existing?.blobStored) await deleteAttachmentBlobs([existing.id]);
  memoryCache.delete(key);
  try {
    await idbSet(key, []);
  } catch {
    /* ignore */
  }
  const map = readLsBackup();
  delete map[key];
  writeLsBackup(map);
}

/** Elimina blobs huérfanos al quitar adjuntos. */
export async function deleteAttachmentBlobs(ids: string[]): Promise<void> {
  for (const id of ids) pendingBlobs.delete(id);
  try {
    await idbDeleteBlobs(ids);
  } catch {
    /* ignore */
  }
}

/** Borra adjuntos en memoria, localStorage e IndexedDB (reset total). */
export async function clearAllAttachmentData(): Promise<void> {
  memoryCache.clear();
  pendingBlobs.clear();
  localStorage.removeItem(LS_KEY);
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}
