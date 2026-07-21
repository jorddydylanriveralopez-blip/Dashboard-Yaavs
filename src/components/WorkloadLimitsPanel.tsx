import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { assignableMarketingTasks } from '../utils/assignmentBrief';
import { workloadLabel } from '../utils/workloadLimits';
import type { WorkloadCheckResult } from '../types';
import './WorkloadLimitsPanel.css';

export function WorkloadLimitsPanel() {
  const {
    board,
    activeUsers,
    canManageWorkloadLimits,
    workloadLimits,
    setDefaultWorkloadLimit,
    setEmployeeWorkloadLimit,
    getWorkloadCheck,
  } = useApp();
  const toast = useToast();

  const [defaultMax, setDefaultMax] = useState(String(workloadLimits.defaultMax));

  const rows = useMemo(() => {
    return assignableMarketingTasks(board.tasks, activeUsers).map((task) => {
      const check = getWorkloadCheck(task.employeeId);
      return { task, check };
    });
  }, [board.tasks, activeUsers, getWorkloadCheck, workloadLimits]);

  if (!canManageWorkloadLimits) return null;

  const saveDefault = () => {
    const n = Number(defaultMax);
    if (!Number.isFinite(n) || n < 1) {
      toast.error('El límite debe ser al menos 1.');
      return;
    }
    setDefaultWorkloadLimit(Math.round(n));
    toast.success('Límite general actualizado');
  };

  return (
    <section className="workload-limits-panel" aria-label="Límites de carga por colaborador">
      <header className="workload-limits-head">
        <div>
          <h2>Límites de trabajos</h2>
          <p>
            Máximo {workloadLimits.defaultMax} proyectos activos por persona. Los terminados y
            las indicaciones pendientes no cuentan. Si alguien está al límite, pedirá tu
            contraseña para asignar uno extra.
          </p>
        </div>
        <label className="workload-limits-default">
          <span>Límite general</span>
          <div className="workload-limits-default-row">
            <input
              type="number"
              min={1}
              max={99}
              value={defaultMax}
              onChange={(e) => setDefaultMax(e.target.value)}
            />
            <button type="button" className="btn-ghost" onClick={saveDefault}>
              Guardar
            </button>
          </div>
        </label>
      </header>

      <div className="workload-limits-table-wrap">
        <table className="workload-limits-table">
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Carga actual</th>
              <th>Máximo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ task, check }) => (
              <WorkloadLimitRow
                key={task.employeeId}
                name={task.employeeName}
                check={check}
                onSave={(max) => {
                  setEmployeeWorkloadLimit(task.employeeId, max);
                  toast.success(`Límite de ${task.employeeName}: ${max} trabajos`);
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WorkloadLimitRow({
  name,
  check,
  onSave,
}: {
  name: string;
  check: WorkloadCheckResult;
  onSave: (max: number) => void;
}) {
  const [max, setMax] = useState(String(check.max));

  return (
    <tr className={check.saturated ? 'workload-limits-row--full' : ''}>
      <td>
        <strong>{name}</strong>
      </td>
      <td>
        <span className="workload-limits-count">{workloadLabel(check)}</span>
        <span className="workload-limits-detail">
          {check.current.projects} proyecto{check.current.projects === 1 ? '' : 's'} activo
          {check.current.projects === 1 ? '' : 's'}
        </span>
      </td>
      <td>
        <input
          type="number"
          min={1}
          max={99}
          className="workload-limits-input"
          value={max}
          onChange={(e) => setMax(e.target.value)}
          onBlur={() => {
            const n = Number(max);
            if (Number.isFinite(n) && n >= 1 && n !== check.max) onSave(Math.round(n));
          }}
        />
      </td>
      <td>
        {check.saturated ? (
          <span className="workload-limits-badge workload-limits-badge--full">Saturado</span>
        ) : check.projected >= check.max - 1 ? (
          <span className="workload-limits-badge workload-limits-badge--warn">Casi lleno</span>
        ) : (
          <span className="workload-limits-badge workload-limits-badge--ok">Disponible</span>
        )}
      </td>
    </tr>
  );
}
