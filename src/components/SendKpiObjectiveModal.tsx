import { useState, type FormEvent } from 'react';
import { SpellCheckTextarea } from './SpellCheckField';
import { currentMonthLabel, endOfMonthDate } from '../utils/kpiObjectives';
import { getMonthKey } from '../utils/performanceHistory';
import type { EmployeeTask } from '../types';
import './SendKpiObjectiveModal.css';

export interface KpiObjectiveFormData {
  employeeId: string;
  objective: string;
  kpiTarget: number;
  dueDate: string;
  notes: string;
}

interface Props {
  target: EmployeeTask | null;
  assignable: EmployeeTask[];
  onClose: () => void;
  onSubmit: (data: KpiObjectiveFormData) => void;
}

export function SendKpiObjectiveModal({ target, assignable, onClose, onSubmit }: Props) {
  const monthKey = getMonthKey();
  const monthLabel = currentMonthLabel();
  const [employeeId, setEmployeeId] = useState(target?.employeeId ?? '');
  const [objective, setObjective] = useState('');
  const [kpiTarget, setKpiTarget] = useState(100);
  const [dueDate, setDueDate] = useState(() => endOfMonthDate(monthKey));
  const [notes, setNotes] = useState('');

  if (!target && assignable.length === 0) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!employeeId || !objective.trim()) return;
    onSubmit({
      employeeId,
      objective: objective.trim(),
      kpiTarget: Math.max(1, kpiTarget),
      dueDate,
      notes: notes.trim(),
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-panel send-kpi-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="send-kpi-title"
      >
        <header className="modal-header">
          <div>
            <h2 id="send-kpi-title">Objetivo KPI del mes</h2>
            <p className="send-kpi-sub">
              {monthLabel} — la persona debe aceptarlo para que cuente en su KPI.
            </p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <form className="send-kpi-form" onSubmit={handleSubmit}>
          {!target && (
            <label>
              Colaborador
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
              >
                <option value="">Selecciona…</option>
                {assignable.map((t) => (
                  <option key={t.employeeId} value={t.employeeId}>
                    {t.employeeName}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            Objetivo a cumplir este mes
            <SpellCheckTextarea
              rows={4}
              value={objective}
              placeholder="Ej. Publicar 12 piezas y alcanzar 50k impresiones"
              onChange={(e) => setObjective(e.target.value)}
              required
            />
          </label>

          <div className="send-kpi-row">
            <label>
              Meta KPI (%)
              <input
                type="number"
                min={1}
                max={100}
                value={kpiTarget}
                onChange={(e) => setKpiTarget(Number(e.target.value) || 100)}
                required
              />
            </label>
            <label>
              Fecha límite
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </label>
          </div>

          <label>
            Notas (opcional)
            <SpellCheckTextarea
              rows={2}
              value={notes}
              placeholder="Criterios de éxito, entregables, etc."
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <footer className="send-kpi-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Enviar objetivo KPI
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
