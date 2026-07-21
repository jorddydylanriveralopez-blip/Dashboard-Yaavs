import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  countUnreadNotifications,
  markNotificationsSeen,
  type EmployeeNotification,
  type NotificationTarget,
} from '../utils/employeeNotifications';
import { NotificationsList } from './NotificationsList';
import './NotificationBell.css';

interface Props {
  notifications: EmployeeNotification[];
  onNavigate: (target: NotificationTarget) => void;
  onMarkedSeen?: () => void;
}

interface PanelPosition {
  top: number;
  right: number;
  width: number;
}

function BellIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5a5 5 0 0 1 5 5v2.5l1.5 2.5H5.5L7 12.5V10a5 5 0 0 1 5-5Z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function NotificationBell({ notifications, onNavigate, onMarkedSeen }: Props) {
  const [open, setOpen] = useState(false);
  const [seenTick, setSeenTick] = useState(0);
  const [panelPos, setPanelPos] = useState<PanelPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const unread = countUnreadNotifications(notifications);

  const updatePanelPosition = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setPanelPos({
      top: rect.bottom + 8,
      right: Math.max(12, window.innerWidth - rect.right),
      width: Math.min(360, window.innerWidth - 24),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }
    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);
    return () => {
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
    };
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleSelect = (item: EmployeeNotification) => {
    markNotificationsSeen();
    setSeenTick((n) => n + 1);
    onMarkedSeen?.();
    setOpen(false);
    onNavigate(item.target);
  };

  const handleMarkAll = () => {
    markNotificationsSeen();
    setSeenTick((n) => n + 1);
    onMarkedSeen?.();
  };

  void seenTick;

  const panel =
    open && panelPos
      ? createPortal(
          <div
            id={panelId}
            ref={panelRef}
            className="notification-bell-panel notification-bell-panel--floating"
            role="dialog"
            aria-label="Notificaciones"
            style={{
              top: panelPos.top,
              right: panelPos.right,
              width: panelPos.width,
            }}
          >
            <div className="notification-bell-panel-head">
              <div>
                <strong>Notificaciones</strong>
                <span>{unread > 0 ? `${unread} sin leer` : 'Al día'}</span>
              </div>
              {unread > 0 && (
                <button
                  type="button"
                  className="btn-ghost notification-bell-mark"
                  onClick={handleMarkAll}
                >
                  Marcar leídas
                </button>
              )}
            </div>
            <div className="notification-bell-panel-body">
              <NotificationsList
                notifications={notifications}
                onSelect={handleSelect}
                compact
                emptyMessage="No tienes notificaciones por ahora."
              />
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className={`notification-bell ${open ? 'is-open' : ''}`} ref={rootRef}>
        <button
          ref={btnRef}
          type="button"
          className={`notification-bell-btn ${open ? 'is-open' : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={panelId}
          title="Notificaciones"
        >
          <BellIcon />
          {unread > 0 && (
            <span className="notification-bell-badge" aria-label={`${unread} sin leer`}>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </div>
      {panel}
    </>
  );
}
