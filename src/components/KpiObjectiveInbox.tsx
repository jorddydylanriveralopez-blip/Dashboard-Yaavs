import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { kpiPercent } from '../utils/kpiStats';
import type { KpiObjectiveAssignment } from '../types';
import './KpiObjectiveInbox.css';

interface Props {
  compact?: boolean;
  onGoKpis?: () => void;
}

export function KpiObjectiveInbox({ compact, onGoKpis }: Props) {
  const {
    myPendingKpiObjectives,
    acceptKpiObjective,
    rejectKpiObjective,
    user,
    board,
  } = useApp();
  const toast = useToast();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  if (myPendingKpiObjectives.length === 0) return null;

  const myTask = board.tasks.find((t) => t.employeeId === user?.employeeId);

  const handleAccept = (item: KpiObjectiveAssignment) => {
    acceptKpiObjective(item.id);
    toast.success('Objetivo KPI aceptado. ¡A cumplirlo este mes!');
  };

  const handleReject = (id: string) => {
    if (!rejectReason.trim()) {
      toast.error('Escribe por qué no puedes aceptar este objetivo.');
      return;
    }
    rejectKpiObjective(id, rejectReason.trim());
    setRejectingId(null);
    setRejectReason('');
    toast.success('Objetivo rechazado. Tu gerente será notificado.');
  };

  return (
    <section className={`kpi-inbox ${compact ? 'kpi-inbox--compact' : ''}`}>
      <header className="kpi-inbox-head">
        <h2>Objetivo KPI del mes</h2>
        {!compact && (
          <p>
            {myPendingKpiObjectives.length === 1
              ? 'Tienes un objetivo por aceptar. Debes cumplirlo antes del fin de mes.'
              : `Tienes ${myPendingKpiObjectives.length} objetivos por revisar.`}
          </p>
        )}
      </header>

      {myTask && myTask.kpiObjectiveMonthKey && (
        <div className="kpi-inbox-current">
          <span>Tu avance actual</span>
          <strong>{kpiPercent(myTask)}%</strong>
        </div>
      )}

      <ul className="kpi-inbox-list">
        {myPendingKpiObjectives.map((item) => (
          <li key={item.id} className="kpi-inbox-card">
            <div className="kpi-inbox-card-head">
              <span className="kpi-inbox-month">{item.monthLabel}</span>
              <span className="kpi-inbox-meta">
                De {item.assignedByName} · meta {item.kpiTarget}%
              </span>
            </div>
            <p className="kpi-inbox-objective">{item.objective}</p>
            {item.notes && <p className="kpi-inbox-notes">{item.notes}</p>}
            <p className="kpi-inbox-due">Cumplir antes del {item.dueDate}</p>

            {rejectingId === item.id ? (
              <div className="kpi-inbox-reject">
                <textarea
                  rows={2}
                  placeholder="Motivo del rechazo…"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
                <div className="kpi-inbox-reject-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setRejectingId(null);
                      setRejectReason('');
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => handleReject(item.id)}
                  >
                    Confirmar rechazo
                  </button>
                </div>
              </div>
            ) : (
              <div className="kpi-inbox-actions">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setRejectingId(item.id)}
                >
                  Rechazar
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handleAccept(item)}
                >
                  Aceptar y comprometerme
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {onGoKpis && (
        <button type="button" className="btn-ghost kpi-inbox-link" onClick={onGoKpis}>
          Ver mis KPIs →
        </button>
      )}
    </section>
  );
}
