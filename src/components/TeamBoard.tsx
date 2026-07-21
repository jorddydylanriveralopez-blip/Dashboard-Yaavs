import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { STATUS_COLORS, STATUS_LABELS } from '../constants';
import { getDeadlineInfo } from '../utils/deadline';
import { collaboratorForEmployeeId } from '../utils/collaboratorMap';
import { projectIncludesCollaborator } from '../utils/projectCollaborators';
import {
  estimatedHoursForProject,
  formatHoursMinutes,
  getHoursPaceInfo,
  hoursPaceBarColor,
  hoursProgressPercent,
} from '../utils/projectHours';
import { labelFor, PROJECT_STATUSES, PROJECT_STATUS_COLORS } from '../data/projectOptions';
import { LiveDeadlineChip } from './ProjectTimelineCountdown';
import type { CreativeProject, EmployeeTask, TaskStatus } from '../types';
import './TeamBoard.css';
import './ProjectTimelineCountdown.css';

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
  onOpenProject?: (project: CreativeProject) => void;
}

export interface MemberProjectCounts {
  active: number;
  overdue: number;
  done: number;
}

function projectsForMember(
  employeeId: string,
  projects: CreativeProject[],
): CreativeProject[] {
  const slug = collaboratorForEmployeeId(employeeId);
  return projects.filter(
    (p) =>
      p.assignedEmployeeId === employeeId ||
      (slug ? projectIncludesCollaborator(p, slug) : false),
  );
}

function countProjects(memberProjects: CreativeProject[]): MemberProjectCounts {
  const counts: MemberProjectCounts = { active: 0, overdue: 0, done: 0 };
  for (const p of memberProjects) {
    if (p.status === 'terminado') counts.done += 1;
    else if (getDeadlineInfo(p.commitmentDate, p.status).tone === 'overdue')
      counts.overdue += 1;
    else counts.active += 1;
  }
  return counts;
}

export function TeamBoard({ tasks, onSelect, onAssign, onSendKpi, onOpenProject }: Props) {
  const { canEditTask, updateTask, canEditAll, removeTeamMember, allProjects, user } =
    useApp();
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
            memberProjects={
              canEditAll || user?.employeeId === task.employeeId
                ? projectsForMember(task.employeeId, allProjects)
                : undefined
            }
            editable={canEditTask(task)}
            canDelete={canEditAll}
            canAssign={Boolean(onAssign)}
            canSendKpi={Boolean(onSendKpi)}
            onOpen={() => onSelect(task)}
            onOpenProject={onOpenProject}
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
  memberProjects,
  editable,
  canDelete,
  canAssign,
  canSendKpi,
  onOpen,
  onOpenProject,
  onAssign,
  onSendKpi,
  onUpdate,
  onDelete,
}: {
  task: EmployeeTask;
  index: number;
  memberProjects?: CreativeProject[];
  editable: boolean;
  canDelete: boolean;
  canAssign: boolean;
  canSendKpi: boolean;
  onOpen: () => void;
  onOpenProject?: (project: CreativeProject) => void;
  onAssign?: () => void;
  onSendKpi?: () => void;
  onUpdate: (patch: Partial<EmployeeTask>) => void;
  onDelete: () => { ok: boolean; error?: string };
}) {
  const { confirm } = useConfirm();
  const toast = useToast();
  const [showProjects, setShowProjects] = useState(false);
  const deadline = getDeadlineInfo(task.dueDate, task.status);
  const kpiPct = Math.min(100, Math.round((task.kpiCurrent / task.kpiTarget) * 100) || 0);
  const projectCounts = memberProjects ? countProjects(memberProjects) : undefined;
  const hasProjects = (memberProjects?.length ?? 0) > 0;

  const toggleProjects = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasProjects) return;
    setShowProjects((v) => !v);
  };

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
          <h3
            className={hasProjects ? 'team-name-toggle' : undefined}
            onClick={toggleProjects}
            title={hasProjects ? 'Clic para ver sus proyectos' : undefined}
          >
            {task.employeeName}
            {hasProjects && (
              <span className={`name-chevron ${showProjects ? 'open' : ''}`} aria-hidden>
                ▾
              </span>
            )}
          </h3>
          <span>{task.roleTitle ?? 'Marketing'}</span>
          {task.assignedByName && (
            <span className="team-assigned-by">Asignado por {task.assignedByName}</span>
          )}
        </div>
        <KpiRing percent={kpiPct} color={task.avatarColor} />
      </header>

      <p className="team-card-work">{task.currentWork}</p>

      {projectCounts && hasProjects && (
        <div
          className="team-card-projects"
          onClick={toggleProjects}
          role="button"
          title="Clic para ver sus proyectos"
        >
          <span className="proj-chip proj-active">
            {projectCounts.active} activo{projectCounts.active === 1 ? '' : 's'}
          </span>
          {projectCounts.overdue > 0 && (
            <span className="proj-chip proj-overdue">
              {projectCounts.overdue} atrasado{projectCounts.overdue === 1 ? '' : 's'}
            </span>
          )}
          <span className="proj-chip proj-done">
            {projectCounts.done} concluido{projectCounts.done === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {showProjects && memberProjects && (
        <div className="member-projects-panel" onClick={(e) => e.stopPropagation()}>
          {[...memberProjects]
            .sort((a, b) => {
              const aDone = a.status === 'terminado' ? 1 : 0;
              const bDone = b.status === 'terminado' ? 1 : 0;
              if (aDone !== bDone) return aDone - bDone;
              return a.commitmentDate.localeCompare(b.commitmentDate);
            })
            .map((p) => {
              const info = getDeadlineInfo(p.commitmentDate, p.status);
              const done = p.status === 'terminado';
              const pace = getHoursPaceInfo(p);
              const trackedMin = p.trackedMinutes ?? 0;
              const estHours = estimatedHoursForProject(p);
              const pct = Math.min(100, hoursProgressPercent(p));
              const body = (
                <>
                  <div className="member-project-top">
                    <strong>{p.projectName.trim() || 'Sin nombre'}</strong>
                    <span
                      className="member-project-status"
                      style={{ background: PROJECT_STATUS_COLORS[p.status] }}
                    >
                      {labelFor(PROJECT_STATUSES, p.status)}
                    </span>
                  </div>
                  <div className="member-project-meta">
                    <span className={`member-project-due tone-${done ? 'done' : info.tone}`}>
                      {done ? 'Entregado' : info.label}
                    </span>
                    {!done && <LiveDeadlineChip project={p} />}
                    <span
                      className="member-project-hours"
                      title={pace.message}
                    >
                      Trabajado {formatHoursMinutes(trackedMin)} / {estHours} h
                    </span>
                  </div>
                  <div className="member-project-bar">
                    <span
                      style={{
                        width: `${pct}%`,
                        background: hoursPaceBarColor(pace.level),
                      }}
                    />
                  </div>
                  {onOpenProject && <span className="member-project-open">Abrir →</span>}
                </>
              );
              if (onOpenProject) {
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="member-project-row member-project-row--openable"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenProject(p);
                    }}
                    title="Abrir proyecto"
                  >
                    {body}
                  </button>
                );
              }
              return (
                <div key={p.id} className="member-project-row">
                  {body}
                </div>
              );
            })}
        </div>
      )}

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
