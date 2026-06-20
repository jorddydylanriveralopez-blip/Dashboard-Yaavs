import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { STATUS_COLORS, STATUS_LABELS } from '../constants';
import { getDeadlineInfo } from '../utils/deadline';
import type { EmployeeTask, TaskStatus } from '../types';
import './TeamBoard.css';

const STATUS_ORDER: TaskStatus[] = [
  'sin_empezar',
  'en_progreso',
  'en_revision',
  'completado',
  'bloqueado',
];

interface Props {
  tasks: EmployeeTask[];
  onSelect: (task: EmployeeTask) => void;
  onAssign?: (task: EmployeeTask) => void;
  onSendKpi?: (task: EmployeeTask) => void;
}

export function TeamBoard({ tasks, onSelect, onAssign, onSendKpi }: Props) {
  const { canEditTask, updateTask, canEditAll, removeTeamMember } = useApp();
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return tasks;
    return tasks.filter((t) => t.status === statusFilter);
  }, [tasks, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: tasks.length };
    for (const s of STATUS_ORDER) {
      c[s] = tasks.filter((t) => t.status === s).length;
    }
    return c;
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <div className="team-board-empty">
        <span className="empty-icon">◇</span>
        <p>Nadie coincide con tu búsqueda.</p>
      </div>
    );
  }

  return (
    <div className="team-board">
      <div className="team-filters">
        <button
          type="button"
          className={`filter-chip ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          Todos <span>{counts.all}</span>
        </button>
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            className={`filter-chip ${statusFilter === s ? 'active' : ''}`}
            style={{ '--chip-color': STATUS_COLORS[s] } as React.CSSProperties}
            onClick={() => setStatusFilter(s)}
          >
            {STATUS_LABELS[s]} <span>{counts[s]}</span>
          </button>
        ))}
      </div>

      <div className="team-grid">
        {filtered.map((task, i) => (
          <TeamCard
            key={task.id}
            task={task}
            index={i}
            editable={canEditTask(task)}
            canDelete={canEditAll}
            canAssign={Boolean(onAssign)}
            canSendKpi={Boolean(onSendKpi)}
            onOpen={() => onSelect(task)}
            onAssign={onAssign ? () => onAssign(task) : undefined}
            onSendKpi={onSendKpi ? () => onSendKpi(task) : undefined}
            onUpdate={(patch) => updateTask(task.id, patch)}
            onDelete={() => removeTeamMember(task.employeeId)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="team-filter-empty">Nadie en este estado. Prueba otro filtro.</p>
      )}
    </div>
  );
}

function TeamCard({
  task,
  index,
  editable,
  canDelete,
  canAssign,
  canSendKpi,
  onOpen,
  onAssign,
  onSendKpi,
  onUpdate,
  onDelete,
}: {
  task: EmployeeTask;
  index: number;
  editable: boolean;
  canDelete: boolean;
  canAssign: boolean;
  canSendKpi: boolean;
  onOpen: () => void;
  onAssign?: () => void;
  onSendKpi?: () => void;
  onUpdate: (patch: Partial<EmployeeTask>) => void;
  onDelete: () => { ok: boolean; error?: string };
}) {
  const { confirm } = useConfirm();
  const toast = useToast();
  const deadline = getDeadlineInfo(task.dueDate, task.status);
  const kpiPct = Math.min(100, Math.round((task.kpiCurrent / task.kpiTarget) * 100) || 0);

  const cycleStatus = () => {
    if (!editable) return;
    const i = STATUS_ORDER.indexOf(task.status);
    const next = STATUS_ORDER[(i + 1) % STATUS_ORDER.length];
    onUpdate({ status: next });
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Dar de baja del equipo',
      message: `¿Quitar permanentemente a ${task.employeeName}? Se eliminará su acceso al panel, tareas e historial asociado.`,
      confirmLabel: 'Dar de baja',
      danger: true,
    });
    if (ok) {
      const result = onDelete();
      if (result.ok) {
        toast.success(`${task.employeeName} fue dado de baja del equipo.`);
      } else if (result.error) {
        await confirm({
          title: 'No se pudo dar de baja',
          message: result.error,
          confirmLabel: 'Entendido',
        });
      }
    }
  };

  return (
    <article
      className="team-card"
      style={
        {
          '--card-accent': task.avatarColor,
          '--stagger': `${index * 55}ms`,
        } as React.CSSProperties
      }
      onClick={onOpen}
    >
      <div className="team-card-glow" aria-hidden />

      <header className="team-card-head">
        <div className="team-avatar" style={{ background: task.avatarColor }}>
          {task.employeeName.charAt(0)}
        </div>
        <div className="team-card-meta">
          <h3>{task.employeeName}</h3>
          <span>{task.roleTitle ?? 'Marketing'}</span>
          {task.assignedByName && (
            <span className="team-assigned-by">Asignado por {task.assignedByName}</span>
          )}
        </div>
        <KpiRing percent={kpiPct} color={task.avatarColor} />
      </header>

      <p className="team-card-work">{task.currentWork}</p>

      <div className="team-card-footer">
        <button
          type="button"
          className="status-chip"
          style={{ background: STATUS_COLORS[task.status] }}
          onClick={(e) => {
            e.stopPropagation();
            cycleStatus();
          }}
          title={editable ? 'Clic para cambiar estado' : undefined}
        >
          {STATUS_LABELS[task.status]}
        </button>
        <span className={`due-chip tone-${deadline.tone}`}>{deadline.label}</span>
      </div>

      <p className="team-card-objective">{task.objective}</p>

      <div className="team-card-actions">
        <span className="open-link">Ver detalle →</span>
        {canSendKpi && onSendKpi && (
          <button
            type="button"
            className="card-kpi"
            onClick={(e) => {
              e.stopPropagation();
              onSendKpi();
            }}
          >
            Objetivo KPI
          </button>
        )}
        {canAssign && onAssign && (
          <button
            type="button"
            className="card-assign"
            onClick={(e) => {
              e.stopPropagation();
              onAssign();
            }}
          >
            Asignar
          </button>
        )}
        {canDelete && (
          <button type="button" className="card-delete" onClick={handleDelete}>
            Dar de baja
          </button>
        )}
      </div>
    </article>
  );
}

function KpiRing({ percent, color }: { percent: number; color: string }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;

  return (
    <div className="kpi-ring" title={`KPI ${percent}%`}>
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--bg-muted)" strokeWidth="4" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 24 24)"
        />
      </svg>
      <span>{percent}%</span>
    </div>
  );
}
