import { useEffect, useState } from 'react';
import { NavIcon, type NavIconId } from './NavIcon';
import './MobileMoreMenu.css';

export interface MobileMoreItem {
  id: string;
  label: string;
  iconId: NavIconId | string;
  badge?: number;
}

interface Props {
  items: MobileMoreItem[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

/** Colores por sección para que cada icono tenga su propia personalidad. */
const TILE_COLORS: Record<string, string> = {
  chat: '#8b5cf6',
  attendance: '#0ea5e9',
  pulse: '#f59e0b',
  community: '#ec4899',
  library: '#10b981',
  calendar: '#f97316',
};

export function MobileMoreMenu({ items, activeId, onSelect, onClose }: Props) {
  const [closing, setClosing] = useState(false);

  const requestClose = () => {
    if (closing) return;
    setClosing(true);
  };

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(onClose, 220);
    return () => clearTimeout(timer);
  }, [closing, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`more-sheet-backdrop ${closing ? 'is-closing' : ''}`}
      onClick={requestClose}
      role="presentation"
    >
      <div
        className={`more-sheet ${closing ? 'is-closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Más secciones"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="more-sheet-handle" aria-hidden="true" />
        <header className="more-sheet-header">
          <h2>Más secciones</h2>
          <button
            type="button"
            className="more-sheet-close"
            onClick={requestClose}
            aria-label="Cerrar menú"
          >
            <NavIcon id="close" size={18} />
          </button>
        </header>
        <div className="more-sheet-grid">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`more-tile ${activeId === item.id ? 'active' : ''}`}
              style={
                {
                  '--tile-accent': TILE_COLORS[item.id] ?? 'var(--accent, #0055ff)',
                  '--tile-delay': `${index * 35}ms`,
                } as React.CSSProperties
              }
              onClick={() => {
                onSelect(item.id);
                requestClose();
              }}
            >
              <span className="more-tile-icon">
                <NavIcon id={item.iconId} size={24} />
                {item.badge != null && item.badge > 0 && (
                  <span className="more-tile-badge">{item.badge}</span>
                )}
              </span>
              <span className="more-tile-label">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
