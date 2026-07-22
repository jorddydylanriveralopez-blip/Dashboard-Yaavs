import { useRef, useState, type ReactNode, type PointerEvent, type MouseEvent } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { notifyPush } from '../api/pushClient';
import { SpellCheckTextarea } from './SpellCheckField';
import {
  ABSENCE_NOTIFY_EMPLOYEE_IDS,
  canReportAbsence,
  openAbsenceWhatsAppToManagers,
} from '../utils/whatsappAbsence';
import './AbsenceReportControl.css';

const LOGO_HOLD_MS = 550;

interface Props {
  /** Variante: logo (mantener oprimido) o botón de texto. */
  variant?: 'logo' | 'button';
  children?: ReactNode;
  className?: string;
}

function todayKeys() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return {
    dateKey: `${y}-${m}-${d}`,
    monthKey: `${y}-${m}`,
  };
}

export function AbsenceReportControl({
  variant = 'button',
  children,
  className = '',
}: Props) {
  const { user, employeePhones, setAttendanceStatus } = useApp();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [holding, setHolding] = useState(false);
  const holdTimerRef = useRef<number | null>(null);
  const holdFiredRef = useRef(false);

  if (!canReportAbsence(user?.employeeId)) {
    if (variant === 'logo') return <>{children}</>;
    return null;
  }

  const clearHoldTimer = () => {
    if (holdTimerRef.current != null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setHolding(false);
  };

  const openAbsenceForm = () => {
    holdFiredRef.current = true;
    setHolding(false);
    setOpen(true);
    try {
      navigator.vibrate?.(25);
    } catch {
      /* ignore */
    }
  };

  const onLogoPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    holdFiredRef.current = false;
    setHolding(true);
    holdTimerRef.current = window.setTimeout(openAbsenceForm, LOGO_HOLD_MS);
  };

  const onLogoPointerEnd = () => {
    clearHoldTimer();
  };

  const onLogoClick = (e: MouseEvent<HTMLButtonElement>) => {
    // Solo long-press abre el modal; el click corto no hace nada.
    if (holdFiredRef.current) {
      e.preventDefault();
      holdFiredRef.current = false;
    }
  };

  const submit = () => {
    if (!user?.employeeId || busy) return;
    setBusy(true);
    try {
      const { dateKey, monthKey } = todayKeys();
      const cleanReason = reason.trim();
      const notifBody = cleanReason
        ? `${user.name} no pudo venir: ${cleanReason}`
        : `${user.name} avisó que no pudo venir hoy`;

      setAttendanceStatus({
        employeeId: user.employeeId,
        employeeName: user.name,
        dateKey,
        monthKey,
        status: 'absent',
        notes: cleanReason || 'Aviso desde el panel: no pudo asistir',
      });

      notifyPush({
        audience: 'employees',
        employeeIds: [...ABSENCE_NOTIFY_EMPLOYEE_IDS],
        excludeUserId: user.id,
        title: 'No pudo asistir',
        body: notifBody.slice(0, 180),
        url: '/asistencia',
        tag: `absence-${user.employeeId}-${dateKey}`,
      });

      openAbsenceWhatsAppToManagers(
        user.name,
        employeePhones,
        cleanReason || undefined,
      );

      toast.success(
        cleanReason
          ? `Notificación enviada a Orlando y Carlos con tu causa.`
          : 'Notificación enviada a Orlando y Carlos.',
      );
      setOpen(false);
      setReason('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {variant === 'logo' ? (
        <button
          type="button"
          className={`absence-logo-hit ${holding ? 'is-holding' : ''} ${className}`.trim()}
          title="Mantén oprimido el logo para avisar que no pudiste venir"
          aria-label="Mantén oprimido el logo Yaavs para avisar que no pudiste venir"
          onPointerDown={onLogoPointerDown}
          onPointerUp={onLogoPointerEnd}
          onPointerLeave={onLogoPointerEnd}
          onPointerCancel={onLogoPointerEnd}
          onClick={onLogoClick}
          onContextMenu={(e) => e.preventDefault()}
        >
          {children}
        </button>
      ) : (
        <button
          type="button"
          className={`absence-report-btn ${className}`.trim()}
          onClick={() => setOpen(true)}
        >
          No pude asistir
        </button>
      )}

      {open && (
        <div
          className="absence-overlay"
          role="presentation"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="absence-panel"
            role="dialog"
            aria-modal
            aria-labelledby="absence-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="absence-title">¿No pudiste venir hoy?</h3>
            <p>
              Escribe la causa y se enviará una notificación a{' '}
              <strong>Orlando</strong> y <strong>Carlos</strong> con tu mensaje.
            </p>
            <label className="absence-field">
              Causa / motivo
              <SpellCheckTextarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={280}
                placeholder="Ej. cita médica, imprevisto familiar, tráfico…"
                autoFocus
              />
            </label>
            <div className="absence-actions">
              <button
                type="button"
                className="btn-ghost"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>
              <button type="button" className="btn-primary" disabled={busy} onClick={submit}>
                {busy ? 'Enviando…' : 'Enviar aviso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
