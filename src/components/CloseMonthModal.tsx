import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { RATING_LABELS } from '../constants';
import { formatMonthLabel, getMonthKey, projectedCurrentMonth } from '../utils/performanceHistory';
import { openPerformanceWhatsApp } from '../utils/whatsappPerformance';
import { SpellCheckTextarea } from './SpellCheckField';
import type { MonthlyPerformanceRecord, PerformanceRating } from '../types';
import './CloseMonthModal.css';

interface DraftRow {
  record: MonthlyPerformanceRecord;
  message: string;
  phone: string;
}

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

const RATING_CLASS: Record<PerformanceRating, string> = {
  positive: 'rating-positive',
  regular: 'rating-regular',
  negative: 'rating-negative',
};

export function CloseMonthModal({ onClose, onSaved }: Props) {
  const {
    user,
    marketingTasks,
    assignments,
    performanceHistory,
    closeCurrentMonthWithRecords,
    employeePhones,
    setEmployeePhone,
  } = useApp();
  const toast = useToast();
  const monthKey = getMonthKey();
  const monthLabel = formatMonthLabel(monthKey);

  const initialDrafts = useMemo((): DraftRow[] => {
    const closedIds = new Set(
      performanceHistory.records
        .filter((r) => r.monthKey === monthKey)
        .map((r) => r.employeeId),
    );
    return marketingTasks
      .filter((t) => !closedIds.has(t.employeeId))
      .map((t) => {
        const record = projectedCurrentMonth(t, assignments);
        return {
          record: {
            ...record,
            monthLabel: formatMonthLabel(monthKey),
            closedBy: 'manager' as const,
          },
          message: record.message,
          phone: employeePhones[t.employeeId] ?? '',
        };
      });
  }, [marketingTasks, assignments, performanceHistory.records, monthKey, employeePhones]);

  const [drafts, setDrafts] = useState<DraftRow[]>(initialDrafts);
  const [sendWhatsApp, setSendWhatsApp] = useState(true);

  if (drafts.length === 0) {
    return (
      <div className="modal-backdrop" onClick={onClose} role="presentation">
        <div
          className="close-month-modal close-month-empty"
          onClick={(e) => e.stopPropagation()}
        >
          <p>Este mes ya fue cerrado para todo el equipo.</p>
          <button type="button" className="btn-primary" onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    );
  }

  const updateDraft = (employeeId: string, patch: Partial<DraftRow>) => {
    setDrafts((prev) =>
      prev.map((d) => (d.record.employeeId === employeeId ? { ...d, ...patch } : d)),
    );
  };

  const buildFinalRecords = (): MonthlyPerformanceRecord[] =>
    drafts.map((d) => ({
      ...d.record,
      message: d.message.trim() || d.record.message,
      closedAt: new Date().toISOString(),
      closedBy: 'manager',
    }));

  const persistPhones = () => {
    for (const d of drafts) {
      if (d.phone.trim()) setEmployeePhone(d.record.employeeId, d.phone.trim());
    }
  };

  const handleSave = (alsoWhatsApp: boolean) => {
    const records = buildFinalRecords();
    persistPhones();
    closeCurrentMonthWithRecords(records);
    toast.success('Mes cerrado y guardado en el historial');

    if (alsoWhatsApp && user) {
      for (let i = 0; i < records.length; i++) {
        const rec = records[i];
        const phone = drafts[i]?.phone;
        setTimeout(() => {
          openPerformanceWhatsApp(rec, user.name, phone);
        }, i * 600);
      }
      toast.success('Abriendo WhatsApp para cada colaborador…');
    }

    onSaved();
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="close-month-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="close-month-title"
      >
        <header className="close-month-header">
          <div>
            <h2 id="close-month-title">Cerrar {monthLabel}</h2>
            <p>Revisa y edita el mensaje de cada persona antes de guardar.</p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <label className="close-month-option">
          <input
            type="checkbox"
            checked={sendWhatsApp}
            onChange={(e) => setSendWhatsApp(e.target.checked)}
          />
          Después de guardar, abrir WhatsApp con el mensaje de cada colaborador
        </label>

        <div className="close-month-list">
          {drafts.map((d) => (
            <article key={d.record.employeeId} className="close-month-row">
              <div className="close-month-row-head">
                <div>
                  <strong>{d.record.employeeName}</strong>
                  <span className={`rating-badge ${RATING_CLASS[d.record.rating]}`}>
                    {RATING_LABELS[d.record.rating]} · {d.record.kpiPercent}%
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-ghost wa-preview"
                  onClick={() => {
                    if (!user) return;
                    persistPhones();
                    openPerformanceWhatsApp(
                      { ...d.record, message: d.message },
                      user.name,
                      d.phone,
                    );
                  }}
                >
                  Probar WhatsApp
                </button>
              </div>

              <label className="close-month-field">
                WhatsApp (10 dígitos, opcional)
                <input
                  type="tel"
                  placeholder="55 1234 5678"
                  value={d.phone}
                  onChange={(e) => updateDraft(d.record.employeeId, { phone: e.target.value })}
                />
              </label>

              <label className="close-month-field">
                Mensaje para {d.record.employeeName}
                <SpellCheckTextarea
                  rows={4}
                  value={d.message}
                  extraWords={[d.record.employeeName]}
                  onChange={(e) => updateDraft(d.record.employeeId, { message: e.target.value })}
                />
              </label>
            </article>
          ))}
        </div>

        <footer className="close-month-footer">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn-ghost" onClick={() => handleSave(false)}>
            Solo guardar
          </button>
          <button type="button" className="btn-primary" onClick={() => handleSave(sendWhatsApp)}>
            {sendWhatsApp ? 'Guardar y enviar por WhatsApp' : 'Guardar cierre de mes'}
          </button>
        </footer>
      </div>
    </div>
  );
}
