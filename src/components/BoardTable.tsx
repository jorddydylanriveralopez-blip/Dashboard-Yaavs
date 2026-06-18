import { useApp } from '../context/AppContext';
import { STATUS_COLORS, STATUS_LABELS } from '../constants';
import { getDeadlineInfo } from '../utils/deadline';
import type { EmployeeTask, TaskStatus } from '../types';
import './BoardTable.css';

interface Props {
  tasks: EmployeeTask[];
  onSelect: (task: EmployeeTask) => void;
}

export function BoardTable({ tasks, onSelect }: Props) {
  const { canEditTask, updateTask, canEditAll, deleteTask } = useApp();

  if (tasks.length === 0) {
    return (
      <div className="board-empty">
        <p>No hay filas que coincidan con tu búsqueda.</p>
      </div>
    );
  }

  return (
    <div className="board-wrap">
      <table className="board-table">
        <thead>
          <tr>
            <th className="col-person">Persona</th>
            <th className="col-work">Qué está haciendo</th>
            <th className="col-status">Estado</th>
            <th className="col-kpi">KPI</th>
            <th className="col-objective">Objetivo</th>
            <th className="col-deadline">Entrega</th>
            <th className="col-notes">Notas</th>
            {canEditAll && <th className="col-actions" />}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <BoardRow
              key={task.id}
              task={task}
              editable={canEditTask(task)}
              canDelete={canEditAll}
              onSelect={() => onSelect(task)}
              onUpdate={(patch) => updateTask(task.id, patch)}
              onDelete={() => deleteTask(task.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BoardRow({
  task,
  editable,
  canDelete,
  onSelect,
  onUpdate,
  onDelete,
}: {
  task: EmployeeTask;
  editable: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<EmployeeTask>) => void;
  onDelete: () => void;
}) {
  const deadline = getDeadlineInfo(task.dueDate, task.status);
  const kpiPct = Math.min(100, Math.round((task.kpiCurrent / task.kpiTarget) * 100) || 0);

  return (
    <tr className={editable ? '' : 'row-readonly'} onClick={onSelect}>
      <td className="col-person" onClick={(e) => e.stopPropagation()}>
        <div className="person-cell">
          <div className="avatar sm" style={{ background: task.avatarColor }}>
            {task.employeeName.charAt(0)}
          </div>
          {editable ? (
            <div className="person-editable">
              <input
                className="cell-input name"
                value={task.employeeName}
                onChange={(e) => onUpdate({ employeeName: e.target.value })}
              />
              <input
                className="cell-input dept"
                value={task.department}
                onChange={(e) => onUpdate({ department: e.target.value })}
              />
            </div>
          ) : (
            <div>
              <strong>{task.employeeName}</strong>
              <span className="dept">{task.roleTitle ?? task.department}</span>
            </div>
          )}
        </div>
      </td>
      <td className="col-work" onClick={(e) => e.stopPropagation()}>
        {editable ? (
          <textarea
            className="cell-textarea"
            value={task.currentWork}
            rows={2}
            onChange={(e) => onUpdate({ currentWork: e.target.value })}
          />
        ) : (
          <span>{task.currentWork}</span>
        )}
      </td>
      <td className="col-status" onClick={(e) => e.stopPropagation()}>
        {editable ? (
          <select
            className="status-select"
            value={task.status}
            style={{ '--status-color': STATUS_COLORS[task.status] } as React.CSSProperties}
            onChange={(e) => onUpdate({ status: e.target.value as TaskStatus })}
          >
            {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        ) : (
          <span
            className="status-pill"
            style={{ background: STATUS_COLORS[task.status] }}
          >
            {STATUS_LABELS[task.status]}
          </span>
        )}
      </td>
      <td className="col-kpi" onClick={(e) => e.stopPropagation()}>
        <div className="kpi-cell">
          <div className="kpi-bar">
            <div className="kpi-fill" style={{ width: `${kpiPct}%` }} />
          </div>
          {editable ? (
            <div className="kpi-inputs">
              <input
                type="number"
                min={0}
                max={task.kpiTarget}
                value={task.kpiCurrent}
                onChange={(e) =>
                  onUpdate({ kpiCurrent: Number(e.target.value) || 0 })
                }
              />
              <span>/ {task.kpiTarget}%</span>
            </div>
          ) : (
            <span className="kpi-label">
              {task.kpiCurrent}% / {task.kpiTarget}%
            </span>
          )}
        </div>
      </td>
      <td className="col-objective" onClick={(e) => e.stopPropagation()}>
        {editable ? (
          <input
            className="cell-input"
            value={task.objective}
            onChange={(e) => onUpdate({ objective: e.target.value })}
          />
        ) : (
          <span>{task.objective}</span>
        )}
      </td>
      <td className="col-deadline" onClick={(e) => e.stopPropagation()}>
        <div className="deadline-cell">
          {editable && (
            <input
              type="date"
              className="date-input"
              value={task.dueDate}
              onChange={(e) => onUpdate({ dueDate: e.target.value })}
            />
          )}
          <span className={`deadline-badge tone-${deadline.tone}`}>
            {deadline.label}
          </span>
        </div>
      </td>
      <td className="col-notes">
        <span className="notes-preview">
          {task.notes ? task.notes.slice(0, 48) + (task.notes.length > 48 ? '…' : '') : '—'}
        </span>
        <span className="open-detail">Abrir →</span>
      </td>
      {canDelete && (
        <td className="col-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="btn-icon danger"
            title="Eliminar fila"
            onClick={() => {
              if (confirm(`¿Eliminar la fila de ${task.employeeName}?`)) onDelete();
            }}
          >
            ×
          </button>
        </td>
      )}
    </tr>
  );
}
