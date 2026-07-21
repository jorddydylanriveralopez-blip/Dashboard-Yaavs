import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import {
  apiBase,
  deleteLibraryImage,
  fetchMediaCatalog,
  uploadLibraryImage,
} from '../api/mediaLibrary';
import { MEDIA_CDN_PATH } from '../constants';
import type { LibraryImageApiItem, MediaCatalogResponse } from '../types';
import './ImageLibraryView.css';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function copyText(text: string) {
  return navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

export function ImageLibraryView() {
  const { user, canEditAll } = useApp();
  const toast = useToast();
  const { confirm } = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);

  const [catalog, setCatalog] = useState<MediaCatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<LibraryImageApiItem | null>(null);
  // Solo el gerente puede alternar entre su biblioteca y la de todo el equipo.
  const [showTeam, setShowTeam] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCatalog(await fetchMediaCatalog());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const base = apiBase();
  const publicUrl = catalog?.publicPage ?? `${base}${MEDIA_CDN_PATH}`;
  const listUrl = catalog?.listUrl ?? `${base}/api/media/list`;

  // Cada quien ve su propio almacenamiento; el gerente puede ver el del equipo.
  const viewingTeam = canEditAll && showTeam;

  const scoped = useMemo(() => {
    const items = catalog?.items ?? [];
    if (viewingTeam || !user) return items;
    return items.filter((item) => item.uploadedBy === user.id);
  }, [catalog?.items, user, viewingTeam]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.uploadedByName.toLowerCase().includes(q) ||
        item.format.toLowerCase().includes(q),
    );
  }, [scoped, query]);

  const processFiles = async (files: FileList | File[]) => {
    if (!user) return;
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!list.length) {
      toast.error('Solo se permiten imágenes');
      return;
    }

    setUploading(true);
    let added = 0;
    try {
      for (const file of list) {
        if (file.size > MAX_IMAGE_BYTES) {
          toast.error(`«${file.name}» supera 8 MB`);
          continue;
        }
        await uploadLibraryImage({
          file,
          uploadedBy: user.id,
          uploadedByName: user.name,
        });
        added += 1;
      }
      await load();
      if (added === 1) toast.success('Imagen guardada en la biblioteca');
      else if (added > 1) toast.success(`${added} imágenes guardadas`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo subir la imagen');
    } finally {
      setUploading(false);
      setDragOver(false);
    }
  };

  const canDeleteImage = (image: LibraryImageApiItem) =>
    canEditAll || image.uploadedBy === user?.id;

  const handleDelete = async (image: LibraryImageApiItem) => {
    if (!canDeleteImage(image)) return;
    const ok = await confirm({
      title: 'Eliminar imagen',
      message: `¿Quitar «${image.name}» de la biblioteca? Los proyectos que ya la usan conservarán su copia adjunta.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;

    try {
      await deleteLibraryImage(image.id);
      setCatalog((prev) =>
        prev
          ? {
              ...prev,
              count: Math.max(0, prev.count - 1),
              items: prev.items.filter((i) => i.id !== image.id),
            }
          : prev,
      );
      if (preview?.id === image.id) setPreview(null);
      toast.success('Imagen eliminada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar');
    }
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files?.length) void processFiles(files);
    e.target.value = '';
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!user || uploading) return;
    if (e.dataTransfer.files?.length) void processFiles(e.dataTransfer.files);
  };

  const handleCopy = async (text: string, label: string) => {
    await copyText(text);
    toast.success(`${label} copiado`);
  };

  return (
    <div className="image-library">
      <section className="image-library-api-panel">
        <div className="image-library-api-head">
          <div>
            <h3>Link para programación</h3>
            <p>Usa el almacén público en sitios, apps o correos. Cada imagen tiene URL directa, tamaño y formato.</p>
          </div>
          <a className="btn btn-primary btn-sm" href={publicUrl} target="_blank" rel="noopener noreferrer">
            Abrir almacén público
          </a>
        </div>
        <div className="image-library-api-links">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void handleCopy(publicUrl, 'Página pública')}>
            Copiar página
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void handleCopy(listUrl, 'API JSON')}>
            Copiar API
          </button>
        </div>
        <code className="image-library-api-code">{listUrl}</code>
      </section>

      <div className="image-library-toolbar">
        <div className="image-library-search">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o formato…"
            aria-label="Buscar imágenes"
          />
        </div>
        <div className="image-library-meta">
          {canEditAll && (
            <div className="image-library-scope" role="tablist" aria-label="Ámbito de la biblioteca">
              <button
                type="button"
                role="tab"
                aria-selected={!showTeam}
                className={`image-library-scope-btn ${!showTeam ? 'active' : ''}`}
                onClick={() => setShowTeam(false)}
              >
                Mías
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={showTeam}
                className={`image-library-scope-btn ${showTeam ? 'active' : ''}`}
                onClick={() => setShowTeam(true)}
              >
                Equipo
              </button>
            </div>
          )}
          <span>{filtered.length} imagen{filtered.length === 1 ? '' : 'es'}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load()}>
            Actualizar
          </button>
        </div>
      </div>

      {user && (
        <div
          className={`image-library-upload ${dragOver ? 'image-library-upload--active' : ''} ${uploading ? 'image-library-upload--busy' : ''}`}
          onDragEnter={(e) => {
            e.preventDefault();
            if (!uploading) setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            if (e.currentTarget === e.target) setDragOver(false);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="image-library-input"
            disabled={uploading}
            onChange={onInputChange}
          />
          <div className="image-library-upload-copy">
            <strong>{uploading ? 'Subiendo…' : 'Subir a mi biblioteca'}</strong>
            <p>Arrastra aquí o elige archivos. Máx. 8 MB. Solo tú ves y administras tus imágenes.</p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            Elegir imágenes
          </button>
        </div>
      )}

      <p className="image-library-hint">
        {viewingTeam
          ? 'Viendo las imágenes de todo el equipo. Cada persona administra su propio almacenamiento.'
          : 'Tu biblioteca personal. Copia el link de cada imagen o úsala desde proyectos con «Desde biblioteca».'}
      </p>

      {loading ? (
        <div className="image-library-empty">Cargando biblioteca…</div>
      ) : filtered.length === 0 ? (
        <div className="image-library-empty">
          <strong>{query ? 'Sin resultados' : 'Aún no hay imágenes'}</strong>
          <p>
            {query
              ? 'Prueba otro término de búsqueda.'
              : viewingTeam
                ? 'Aún nadie del equipo ha subido imágenes.'
                : 'Sube tu primera imagen con el botón de arriba.'}
          </p>
        </div>
      ) : (
        <div className="image-library-grid">
          {filtered.map((image) => (
            <article key={image.id} className="image-library-card">
              <button
                type="button"
                className="image-library-thumb"
                onClick={() => setPreview(image)}
                aria-label={`Ver ${image.name}`}
              >
                <img src={image.url} alt={image.name} loading="lazy" />
              </button>
              <div className="image-library-card-body">
                <strong className="image-library-card-name" title={image.name}>
                  {image.name}
                </strong>
                <div className="image-library-card-tags">
                  <span>{image.format}</span>
                  <span>{image.sizeLabel}</span>
                  {image.dimensions && <span>{image.dimensions}px</span>}
                </div>
                <span className="image-library-card-meta">{image.uploadedByName}</span>
                <div className="image-library-card-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => void handleCopy(image.url, 'URL')}>
                    Copiar URL
                  </button>
                  {image.downloadUrl && (
                    <a className="btn btn-ghost btn-sm" href={image.downloadUrl}>
                      Descargar
                    </a>
                  )}
                </div>
              </div>
              {canDeleteImage(image) && (
                <button
                  type="button"
                  className="image-library-delete"
                  onClick={() => void handleDelete(image)}
                  aria-label={`Eliminar ${image.name}`}
                >
                  ×
                </button>
              )}
            </article>
          ))}
        </div>
      )}

      {preview && (
        <ImagePreviewLightbox
          image={preview}
          onClose={() => setPreview(null)}
          onCopy={(text, label) => void handleCopy(text, label)}
        />
      )}
    </div>
  );
}

function ImagePreviewLightbox({
  image,
  onClose,
  onCopy,
}: {
  image: LibraryImageApiItem;
  onClose: () => void;
  onCopy: (text: string, label: string) => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const shortUrl = useMemo(() => {
    try {
      const u = new URL(image.url);
      const path = u.pathname.split('/').pop() ?? image.name;
      return `…/${path}`;
    } catch {
      return image.name;
    }
  }, [image.url, image.name]);

  return (
    <div
      className="image-preview-lightbox"
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-preview-title"
      onClick={onClose}
    >
      <div className="image-preview-shell" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="image-preview-close"
          onClick={onClose}
          aria-label="Cerrar vista previa"
        >
          ×
        </button>

        <div className="image-preview-layout">
          <div className="image-preview-stage">
            <img src={image.url} alt={image.name} />
          </div>

          <aside className="image-preview-sidebar">
            <div className="image-preview-sidebar-head">
              <h2 id="image-preview-title">{image.name}</h2>
              <p>Subida por {image.uploadedByName}</p>
            </div>

            <div className="image-preview-stats">
              <div className="image-preview-stat">
                <span className="image-preview-stat-label">Formato</span>
                <strong>{image.format}</strong>
              </div>
              <div className="image-preview-stat">
                <span className="image-preview-stat-label">Tamaño</span>
                <strong>{image.sizeLabel}</strong>
              </div>
              {image.dimensions && (
                <div className="image-preview-stat">
                  <span className="image-preview-stat-label">Dimensiones</span>
                  <strong>{image.dimensions} px</strong>
                </div>
              )}
              <div className="image-preview-stat">
                <span className="image-preview-stat-label">Extensión</span>
                <strong>.{image.extension}</strong>
              </div>
            </div>

            <div className="image-preview-url-block">
              <span className="image-preview-url-label">URL directa</span>
              <div className="image-preview-url-row">
                <input
                  type="text"
                  className="image-preview-url-input"
                  value={image.url}
                  readOnly
                  aria-label="URL de la imagen"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm image-preview-url-copy"
                  onClick={() => onCopy(image.url, 'URL')}
                >
                  Copiar
                </button>
              </div>
              <span className="image-preview-url-hint" title={image.url}>
                {shortUrl}
              </span>
            </div>

            <div className="image-preview-actions">
              <button type="button" className="btn btn-primary" onClick={() => onCopy(image.url, 'URL')}>
                Copiar URL
              </button>
              {image.downloadUrl && (
                <a className="btn btn-ghost" href={image.downloadUrl} target="_blank" rel="noopener noreferrer">
                  Descargar
                </a>
              )}
              <a className="btn btn-ghost" href={image.url} target="_blank" rel="noopener noreferrer">
                Abrir en pestaña
              </a>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
