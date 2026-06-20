import './MobileMoreMenu.css';

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  badge?: number;
}

interface Props {
  items: MenuItem[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function MobileMoreMenu({ items, activeId, onSelect, onClose }: Props) {
  return (
    <div className="mobile-more-backdrop" onClick={onClose} role="presentation">
      <nav
        className="mobile-more-panel"
        aria-label="Más opciones"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mobile-more-head">
          <h2>Más</h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        <ul className="mobile-more-list">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`mobile-more-item ${activeId === item.id ? 'active' : ''}`}
                onClick={() => {
                  onSelect(item.id);
                  onClose();
                }}
              >
                <span className="mobile-more-icon">{item.icon}</span>
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="mobile-more-badge">{item.badge}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
