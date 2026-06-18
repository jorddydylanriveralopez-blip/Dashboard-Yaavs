import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { RATING_LABELS } from '../constants';
import {
  formatMonthLabel,
  getMonthKey,
  listMonthKeys,
  projectedCurrentMonth,
  recordsForMonth,
} from '../utils/performanceHistory';
import { CloseMonthModal } from './CloseMonthModal';
import { openPerformanceWhatsApp } from '../utils/whatsappPerformance';
import type { MonthlyPerformanceRecord, PerformanceRating } from '../types';
import './MonthlyHistoryView.css';

const RATING_CLASS: Record<PerformanceRating, string> = {
  positive: 'rating-positive',
  regular: 'rating-regular',
  negative: 'rating-negative',
};

export function MonthlyHistoryView() {
  const {
    user,
    canEditAll,
    performanceHistory,
    marketingTasks,
    assignments,
    employeePhones,
  } = useApp();
  const toast = useToast();

  const months = useMemo(() => listMonthKeys(performanceHistory), [performanceHistory]);
  const [monthKey, setMonthKey] = useState(() => getMonthKey());
  const [showCloseModal, setShowCloseModal] = useState(false);
  const currentMonth = getMonthKey();
  const isCurrentMonth = monthKey === currentMonth;

  const historyRows = useMemo(() => {
    if (!isCurrentMonth) {
      let rows = recordsForMonth(performanceHistory, monthKey);
      if (!canEditAll && user?.employeeId) {
        rows = rows.filter((r) => r.employeeId === user.employeeId);
      }
      return rows;
    }

    let tasks = marketingTasks;
    if (!canEditAll && user?.employeeId) {
      tasks = tasks.filter((t) => t.employeeId === user.employeeId);
    }

    const closed = recordsForMonth(performanceHistory, monthKey);
    const closedIds = new Set(closed.map((r) => r.employeeId));

    const live: MonthlyPerformanceRecord[] = tasks
      .filter((t) => !closedIds.has(t.employeeId))
      .map((t) => projectedCurrentMonth(t, assignments));

    return [...closed, ...live].sort((a, b) =>
      a.employeeName.localeCompare(b.employeeName),
    );
  }, [
    performanceHistory,
    monthKey,
    isCurrentMonth,
    canEditAll,
    user?.employeeId,
    marketingTasks,
    assignments,
  ]);

  const summary = useMemo(() => {
    const positive = historyRows.filter((r) => r.rating === 'positive').length;
    const negative = historyRows.filter((r) => r.rating === 'negative').length;
    return { positive, negative, total: historyRows.length };
  }, [historyRows]);

  return (
    <div className="monthly-history">
      {showCloseModal && (
        <CloseMonthModal
          onClose={() => setShowCloseModal(false)}
          onSaved={() => toast.success('Historial actualizado')}
        />
      )}
      <div className="history-toolbar">
        <label>
          Mes
          <select
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            className="history-month-select"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
                {m === currentMonth ? ' (actual)' : ''}
              </option>
            ))}
          </select>
        </label>

        {canEditAll && isCurrentMonth && (
          <button type="button" className="btn-primary" onClick={() => setShowCloseModal(true)}>
            Cerrar mes (editar mensajes)
          </button>
        )}
      </div>

      {canEditAll && (
        <div className="history-summary">
          <span className="summary-chip positive">{summary.positive} aprobados</span>
          <span className="summary-chip negative">{summary.negative} por mejorar</span>
          <span className="summary-chip">{summary.total} en total</span>
        </div>
      )}

      <p className="history-hint">
        {isCurrentMonth
          ? 'Al cerrar mes puedes editar cada mensaje y enviarlo por WhatsApp.'
          : 'Registro guardado al cerrar ese mes.'}{' '}
        Aprobado: KPI ≥ 75%. Por mejorar: KPI &lt; 50%.
      </p>

      {historyRows.length === 0 ? (
        <p className="history-empty">
          Aún no hay registros para este mes. El gerente puede usar «Cerrar mes» al final del
          periodo.
        </p>
      ) : (
        <div className="history-grid">
          {historyRows.map((row) => (
            <HistoryCard
              key={row.id}
              row={row}
              isLive={isCurrentMonth && !row.closedAt}
              canSendWhatsApp={canEditAll && Boolean(row.closedAt)}
              phone={employeePhones[row.employeeId]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryCard({
  row,
  isLive,
  canSendWhatsApp,
  phone,
}: {
  row: MonthlyPerformanceRecord;
  isLive: boolean;
  canSendWhatsApp: boolean;
  phone?: string;
}) {
  const { user } = useApp();

  return (
    <article className={`history-card ${RATING_CLASS[row.rating]}`}>
      <header className="history-card-head">
        <div>
          <h3>{row.employeeName}</h3>
          <span className={`rating-badge ${RATING_CLASS[row.rating]}`}>
            {RATING_LABELS[row.rating]}
            {isLive ? ' · en curso' : ''}
          </span>
        </div>
        <strong className="history-kpi">{row.kpiPercent}%</strong>
      </header>

      <p className="history-work">{row.currentWork}</p>
      <p className="history-objective">
        <span>Objetivo:</span> {row.objective}
      </p>

      {!isLive && (
        <p className="history-stats">
          Indicaciones aceptadas: {row.assignmentsAccepted}
          {row.assignmentsRejected > 0 && ` · Rechazadas: ${row.assignmentsRejected}`}
        </p>
      )}

      <blockquote className="history-message">{row.message}</blockquote>

      {canSendWhatsApp && user && (
        <button
          type="button"
          className="btn-ghost history-wa-btn"
          onClick={(e) => {
            e.stopPropagation();
            openPerformanceWhatsApp(row, user.name, phone);
          }}
        >
          Enviar por WhatsApp
        </button>
      )}
    </article>
  );
}
