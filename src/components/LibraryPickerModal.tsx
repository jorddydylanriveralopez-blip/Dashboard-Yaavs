import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchLibraryImages } from '../api/mediaLibrary';
import { filterLibraryImages, libraryImagesToAttachments } from '../utils/imageLibrary';
import { useApp } from '../context/AppContext';
import type { FileAttachment, LibraryImage } from '../types';
import './LibraryPickerModal.css';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (attachments: FileAttachment[]) => void;
  existingAttachmentIds?: string[];
}

export function LibraryPickerModal({ open, onClose, onSelect, existingAttachmentIds = [] }: Props) {
  const { user } = useApp();
  const [images, setImages] = useState<LibraryImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await fetchLibraryImages();
      setImages(user ? items.filter((img) => img.uploadedBy === user.id) : items);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setQuery('');
    void load();
  }, [open, load]);

  const filtered = useMemo(() => filterLibraryImages(images, query), [images, query]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const picked = images.filter((img) => selected.has(img.id));
    if (!picked.length) {
      onClose();
      return;
    }
    onSelect(libraryImagesToAttachments(picked));
    onClose();
  };

  if (!open) return null;

  return (
    <div className="library-picker-backdrop" role="presentation" onClick={onClose}>
      <div
        className="library-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-picker-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="library-picker-header">
          <div>
            <h3 id="library-picker-title">Elegir de mi biblioteca</h3>
            <p>Selecciona una o varias imágenes de tu almacenamiento personal.</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cerrar
          </button>
        </header>

        <div className="library-picker-search">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar imagen…"
            aria-label="Buscar en biblioteca"
          />
        </div>

        <div className="library-picker-body">
          {loading ? (
            <p className="library-picker-empty">Cargando imágenes…</p>
          ) : filtered.length === 0 ? (
            <p className="library-picker-empty">
              {query ? 'No hay coincidencias.' : 'La biblioteca está vacía. Sube imágenes en el apartado Biblioteca.'}
            </p>
          ) : (
            <div className="library-picker-grid">
              {filtered.map((image) => {
                const isSelected = selected.has(image.id);
                const alreadyAttached = existingAttachmentIds.includes(image.id);
                return (
                  <label
                    key={image.id}
                    className={`library-picker-card ${isSelected ? 'library-picker-card--selected' : ''} ${alreadyAttached ? 'library-picker-card--disabled' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={alreadyAttached}
                      onChange={() => toggle(image.id)}
                    />
                    <img src={image.url} alt={image.name} loading="lazy" />
                    <span className="library-picker-card-name">{image.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <footer className="library-picker-footer">
          <span>{selected.size} seleccionada{selected.size === 1 ? '' : 's'}</span>
          <div className="library-picker-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={selected.size === 0}
              onClick={handleConfirm}
            >
              Adjuntar
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
