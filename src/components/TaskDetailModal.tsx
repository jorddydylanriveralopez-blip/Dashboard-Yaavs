import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useConfirm } from '../context/ConfirmContext';
import { STATUS_COLORS, STATUS_LABELS } from '../constants';
import { getDeadlineInfo } from '../utils/deadline';
import { hasActiveKpiObjective } from '../utils/kpiObjectives';
import { getMonthKey } from '../utils/performanceHistory';
import { collaboratorForEmployeeId } from '../utils/collaboratorMap';
import { projectIncludesCollaborator } from '../utils/projectCollaborators';
import { formatShortDate } from '../utils/formatDate';
import { labelFor, PROJECT_STATUSES, PROJECT_STATUS_COLORS } from '../data/projectOptions';
import { FileAttachmentsEditor, FileAttachmentsList } from './FileAttachments';
import { SpellCheckInput, SpellCheckTextarea } from './SpellCheckField';
import type { CreativeProject, EmployeeTask, TaskStatus } from '../types';
import './TaskDetailModal.css';

interface Props {
  taskId: string;
  onClose: () => void;
}

export function TaskDetailModal({ taskId, onClose }: Props) {
  const { board, allProjects, canEditTask, updateTask, deleteTask, canEditAll, user } =
    useApp();
  const { confirm } = useConfirm();

  const task = useMemo(
    () => board.tasks.find((t) => t.id === taskId),
    [board.tasks, taskId],
  );

  useEffect(() => {
    if (!task) onClose();
  }, [task, onClose]);

  if (!task) return null;

  const editable = canEditTask(task);
  const isOwnTask = user?.employeeId === task.employeeId;
  const lockedKpiFields =
    isOwnTask && !canEditAll && hasActiveKpiObjective(task, getMonthKey());
  const canEditObjectiveFields = editable && !lockedKpiFields;
  const canEditProgressFields = editable;
  const deadline = getDeadlineInfo(task.dueDate, task.status);
  // Proyectos del colaborador: el gerente ve los de todos; cada quien ve los suyos.
  const canSeeProjects = canEditAll || isOwnTask;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="modal-title"
      >
        <header className="modal-header">
          <div className="modal-person">
            <div className="avatar" style={{ background: task.avatarColor }}>
              {task.employeeName.charAt(0)}
            </div>
            <div>
              <h2 id="modal-title">{task.employeeName}</h2>
              <span>{task.department}</span>
              {task.assignedByName && (
                <span className="modal-assigned-by">
                  Indicación de {task.assignedByName}
                  {task.assignedAt
                    ? ` · ${new Date(task.assignedAt).toLocaleDateString('es-MX')}`
                    : ''}
                </span>
              )}
            </div>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className="modal-body">
          <section>
            <label>Trabajo actual</label>
            {editable ? (
              <SpellCheckTextarea
                value={task.currentWork}
                rows={3}
                extraWords={[task.employeeName]}
                onChange={(e) => updateTask(task.id, { currentWork: e.target.value })}
              />
            ) : (
              <p>{task.currentWork}</p>
            )}
          </section>

          <div className="modal-grid">
            <section>
              <label>Estado</label>
              {editable ? (
                <select
                  value={task.status}
                  onChange={(e) =>
                    updateTask(task.id, { status: e.target.value as TaskStatus })
                  }
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
            </section>

            <section>
              <label>Prioridad</label>
              {editable ? (
                <select
                  value={task.priority}
                  onChange={(e) =>
                    updateTask(task.id, {
                      priority: e.target.value as EmployeeTask['priority'],
                    })
                  }
                >
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              ) : (
                <p className="capitalize">{task.priority}</p>
              )}
            </section>

            <section>
              <label>KPI actual / meta</label>
              {canEditProgressFields ? (
                <div className="kpi-row">
                  <input
                    type="number"
                    min={0}
                    value={task.kpiCurrent}
                    onChange={(e) =>
                      updateTask(task.id, { kpiCurrent: Number(e.target.value) || 0 })
                    }
                  />
                  <span>/</span>
                  {canEditObjectiveFields ? (
                    <input
                      type="number"
                      min={1}
                      value={task.kpiTarget}
                      onChange={(e) =>
                        updateTask(task.id, { kpiTarget: Number(e.target.value) || 100 })
                      }
                    />
                  ) : (
                    <strong>{task.kpiTarget}</strong>
                  )}
                  <span>%</span>
                </div>
              ) : (
                <p>
                  {task.kpiCurrent}% / {task.kpiTarget}%
                </p>
              )}
              {lockedKpiFields && task.kpiAssignedByName && (
                <p className="modal-kpi-lock">
                  Meta fijada por {task.kpiAssignedByName} para este mes. Actualiza tu avance en
                  «KPI actual».
                </p>
              )}
            </section>

            <section>
              <label>Fecha de entrega</label>
              {canEditObjectiveFields ? (
                <input
                  type="date"
                  value={task.dueDate}
                  onChange={(e) => updateTask(task.id, { dueDate: e.target.value })}
                />
              ) : (
                <p>{task.dueDate}</p>
              )}
              <span className={`deadline-badge tone-${deadline.tone}`}>
                {deadline.label}
              </span>
            </section>
          </div>

          <section>
            <label>Objetivo del periodo</label>
            {canEditObjectiveFields ? (
              <SpellCheckInput
                value={task.objective}
                onChange={(e) => updateTask(task.id, { objective: e.target.value })}
              />
            ) : (
              <p>{task.objective}</p>
            )}
          </section>

          {canSeeProjects && (
            <MemberProjectsSection employeeId={task.employeeId} projects={allProjects} />
          )}

          <section>
            <label>Notas</label>
            {editable ? (
              <SpellCheckTextarea
                value={task.notes}
                rows={5}
                placeholder="Comentarios, bloqueos, próximos pasos…"
                extraWords={[task.employeeName]}
                onChange={(e) => updateTask(task.id, { notes: e.target.value })}
              />
            ) : (
              <p className="notes-full">{task.notes || 'Sin notas'}</p>
            )}
          </section>

          {(editable || (task.attachments?.length ?? 0) > 0) && (
            <section>
              <label>Archivos e imágenes</label>
              {editable ? (
                <FileAttachmentsEditor
                  attachments={task.attachments ?? []}
                  onChange={(attachments) => updateTask(task.id, { attachments })}
                />
              ) : (
                <FileAttachmentsList attachments={task.attachments ?? []} />
              )}
            </section>
          )}

          {(editable || task.attachmentUrl) && (
            <section>
              <label>Enlace externo</label>
              {editable ? (
                <input
                  type="url"
                  value={task.attachmentUrl ?? ''}
                  placeholder="https://…"
                  onChange={(e) =>
                    updateTask(task.id, {
                      attachmentUrl: e.target.value.trim() || undefined,
                    })
                  }
                />
              ) : task.attachmentUrl ? (
                <a
                  href={task.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="modal-attachment-link"
                >
                  Abrir enlace externo
                </a>
              ) : null}
            </section>
          )}
        </div>

        <footer className="modal-footer">
          {canEditAll && (
            <button
              type="button"
              className="btn-danger"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Eliminar fila',
                  message: `¿Eliminar la fila de ${task.employeeName}?`,
                  confirmLabel: 'Eliminar',
                  danger: true,
                });
                if (ok) {
                  deleteTask(task.id);
                  onClose();
                }
              }}
            >
              Eliminar fila
            </button>
          )}
          <button type="button" className="btn-primary" onClick={onClose}>
            Listo
          </button>
        </footer>
      </div>
    </div>
  );
}

type ProjectGroupKey = 'overdue' | 'active' | 'done';

interface ProjectGroup {
  key: ProjectGroupKey;
  label: string;
  projects: CreativeProject[];
}

function MemberProjectsSection({
  employeeId,
  projects,
}: {
  employeeId: string;
  projects: CreativeProject[];
}) {
  const [openGroup, setOpenGroup] = useState<ProjectGroupKey | null>(null);

  const groups = useMemo<ProjectGroup[]>(() => {
    const slug = collaboratorForEmployeeId(employeeId);
    const mine = projects.filter((p) => {
      if (p.assignedEmployeeId === employeeId) return true;
      return slug ? projectIncludesCollaborator(p, slug) : false;
    });

    const overdue: CreativeProject[] = [];
    const active: CreativeProject[] = [];
    const done: CreativeProject[] = [];
    for (const p of mine) {
      if (p.status === 'terminado') {
        done.push(p);
      } else if (getDeadlineInfo(p.commitmentDate, p.status).tone === 'overdue') {
        overdue.push(p);
      } else {
        active.push(p);
      }
    }
    overdue.sort((a, b) => a.commitmentDate.localeCompare(b.commitmentDate));
    active.sort((a, b) => a.commitmentDate.localeCompare(b.commitmentDate));
    done.sort((a, b) =>
      (b.finishedDate ?? b.updatedAt).localeCompare(a.finishedDate ?? a.updatedAt),
    );

    return [
      { key: 'overdue' as const, label: 'Atrasados', projects: overdue },
      { key: 'active' as const, label: 'Activos', projects: active },
      { key: 'done' as const, label: 'Concluidos', projects: done },
    ];
  }, [employeeId, projects]);

  const total = groups.reduce((sum, g) => sum + g.projects.length, 0);
  const overdueCount = groups[0].projects.length;

  useEffect(() => {
    setOpenGroup(overdueCount > 0 ? 'overdue' : total > 0 ? 'active' : null);
    // Solo al abrir el modal de otra persona.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  return (
    <section className="member-projects">
      <label>Proyectos ({total})</label>
      {total === 0 ? (
        <p className="member-projects-empty">Sin proyectos asignados por ahora.</p>
      ) : (
        <div className="member-projects-groups">
          {groups.map((group) => {
            const isOpen = openGroup === group.key;
            return (
              <div key={group.key} className={`project-group project-group--${group.key}`}>
                <button
                  type="button"
                  className="project-group-toggle"
                  aria-expanded={isOpen}
                  disabled={group.projects.length === 0}
                  onClick={() => setOpenGroup(isOpen ? null : group.key)}
                >
                  <span className="project-group-dot" aria-hidden />
                  <span className="project-group-name">{group.label}</span>
                  <span className="project-group-count">{group.projects.length}</span>
                  <span className={`project-group-chevron ${isOpen ? 'open' : ''}`} aria-hidden>
                    ▾
                  </span>
                </button>
                {isOpen && group.projects.length > 0 && (
                  <ul className="project-group-list">
                    {group.projects.map((p) => {
                      const info = getDeadlineInfo(p.commitmentDate, p.status);
                      return (
                        <li key={p.id} className="project-group-item">
                          <div className="project-item-main">
                            <strong>{p.projectName.trim() || 'Sin nombre'}</strong>
                            <span
                              className="project-item-status"
                              style={{ background: PROJECT_STATUS_COLORS[p.status] }}
                            >
                              {labelFor(PROJECT_STATUSES, p.status)}
                            </span>
                          </div>
                          <div className="project-item-meta">
                            {group.key === 'done' ? (
                              <span>
                                Entregado{' '}
                                {p.finishedDate ? formatShortDate(p.finishedDate) : '—'}
                              </span>
                            ) : (
                              <>
                                <span>Compromiso {formatShortDate(p.commitmentDate)}</span>
                                <span className={`project-item-deadline tone-${info.tone}`}>
                                  {info.label}
                                </span>
                              </>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
