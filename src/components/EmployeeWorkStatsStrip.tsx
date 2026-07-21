import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { EmployeeWorkStats } from '../utils/employeeWorkStats';
import { MobileStatIcon } from './NavIcon';
import './EmployeeWorkStatsStrip.css';

export type EmployeeStatKey = keyof EmployeeWorkStats | 'notifications';
type WorkStatKey = keyof EmployeeWorkStats;

export interface EmployeeStatDetail {
  id: string;
  title: string;
  meta?: string;
  projectId?: string;
  target?: string;
}

type StatItem = {
  key: WorkStatKey;
  label: string;
  icon: 'projects' | 'done' | 'urgent' | 'overdue' | 'soon' | 'pending';
  tone?: 'danger' | 'warn' | 'ok';
};

const ITEMS: StatItem[] = [
  { key: 'active', label: 'Mis trabajos', icon: 'projects' },
  { key: 'completed', label: 'Completados', icon: 'done', tone: 'ok' },
  { key: 'urgent', label: 'Urgentes', icon: 'urgent', tone: 'danger' },
  { key: 'notDelivered', label: 'No entregados', icon: 'overdue', tone: 'danger' },
  { key: 'dueSoon', label: 'Por acabar', icon: 'soon', tone: 'warn' },
  { key: 'pendingAssignments', label: 'Indic. pend.', icon: 'pending', tone: 'warn' },
];

interface Props {
  stats: EmployeeWorkStats;
  variant: 'sidebar' | 'mobile';
  notificationCount?: number;
  details?: Partial<Record<EmployeeStatKey, EmployeeStatDetail[]>>;
  onOpenDetail?: (detail: EmployeeStatDetail, key: EmployeeStatKey) => void;
}

export function EmployeeWorkStatsStrip({
  stats,
  variant,
  notificationCount = 0,
  details = {},
  onOpenDetail,
}: Props) {
  const [openKey, setOpenKey] = useState<EmployeeStatKey | null>(null);
  const [showAll, setShowAll] = useState(false);
  const className =
    variant === 'sidebar' ? 'employee-stats employee-stats--sidebar' : 'employee-stats employee-stats--mobile';
  const openItem =
    openKey === 'notifications'
      ? { key: 'notifications' as const, label: 'Notificaciones' }
      : ITEMS.find((item) => item.key === openKey);
  const openDetails = openKey ? details[openKey] ?? [] : [];
  const visibleDetails = showAll ? openDetails : openDetails.slice(0, 5);

  const open = (key: EmployeeStatKey) => {
    setOpenKey(key);
    setShowAll(false);
  };

  return (
    <>
      <div className={className} aria-label="Resumen de tus trabajos">
        {ITEMS.map((item) => (
          <button
            type="button"
            key={item.key}
            className={`employee-stat employee-stat--${item.tone ?? 'default'}`}
            onClick={() => open(item.key)}
            aria-label={`Ver ${item.label.toLowerCase()}`}
          >
            {variant === 'mobile' && <MobileStatIcon kind={item.icon} />}
            <strong>{stats[item.key]}</strong>
            <span>{item.label}</span>
          </button>
        ))}
        {notificationCount > 0 && (
          <button
            type="button"
            className="employee-stat employee-stat--notify"
            title="Notificaciones sin leer"
            onClick={() => open('notifications')}
          >
            {variant === 'mobile' && <MobileStatIcon kind="notify" />}
            <strong>{notificationCount}</strong>
            <span>Notific.</span>
          </button>
        )}
      </div>

      {openKey &&
        openItem &&
        createPortal(
          <div
            className="employee-stat-modal-backdrop"
            role="presentation"
            onClick={() => setOpenKey(null)}
          >
            <section
              className="employee-stat-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="employee-stat-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="employee-stat-modal-head">
                <div>
                  <h2 id="employee-stat-modal-title">{openItem.label}</h2>
                  <p>{openDetails.length} en total</p>
                </div>
                <button
                  type="button"
                  className="employee-stat-modal-close"
                  onClick={() => setOpenKey(null)}
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </header>

              {visibleDetails.length === 0 ? (
                <p className="employee-stat-modal-empty">No hay elementos en esta sección.</p>
              ) : (
                <ul className="employee-stat-detail-list">
                  {visibleDetails.map((detail) => (
                    <li key={detail.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onOpenDetail?.(detail, openKey);
                          setOpenKey(null);
                        }}
                        disabled={!onOpenDetail}
                      >
                        <span>{detail.title}</span>
                        {detail.meta && <small>{detail.meta}</small>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {openDetails.length > 5 && (
                <button
                  type="button"
                  className="btn-ghost employee-stat-show-more"
                  onClick={() => setShowAll((value) => !value)}
                >
                  {showAll ? 'Ver menos' : `Ver más (${openDetails.length - 5})`}
                </button>
              )}
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
