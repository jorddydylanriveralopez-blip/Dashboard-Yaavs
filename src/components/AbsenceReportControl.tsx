import { useState, type ReactNode } from 'react';
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

interface Props {
  /** Variante: logo clickeable o botón de texto. */
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

  if (!canReportAbsence(user?.employeeId)) {
    if (variant === 'logo') return <>{children}</>;
    return null;
  }

  const submit = () => {
    if (!user?.employeeId || busy) return;
    setBusy(true);
    try {
      const { dateKey, monthKey } = todayKeys();
      const cleanReason = reason.trim();

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
        body: cleanReason
          ? `${user.name}: ${cleanReason.slice(0, 120)}`
          : `${user.name} avisó que no pudo venir hoy`,
        url: '/asistencia',
        tag: `absence-${user.employeeId}-${dateKey}`,
      });

      const { missingPhones } = openAbsenceWhatsAppToManagers(
        user.name,
        employeePhones,
        cleanReason || undefined,
      );

      if (missingPhones.length > 0) {
        toast.info(
          'Aviso enviado. Si falta un WhatsApp, agrega el teléfono de Orlando/Carlos en el equipo.',
        );
      } else {
        toast.success(
          'Aviso enviado a Orlando y Carlos. Se abrió WhatsApp con el mensaje listo.',
        );
      }
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
          className={`absence-logo-hit ${className}`.trim()}
          title="Avisar que no pude asistir"
          aria-label="Avisar que no pude asistir (logo Yaavs)"
          onClick={() => setOpen(true)}
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
              Se avisará a <strong>Orlando</strong> y <strong>Carlos</strong> en el panel y se
              abrirá WhatsApp con un mensaje listo para ambos.
            </p>
            <label className="absence-field">
              Motivo (opcional)
              <SpellCheckTextarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={280}
                placeholder="Ej. cita médica, imprevisto familiar…"
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
                {busy ? 'Enviando…' : 'Avisar ahora'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
