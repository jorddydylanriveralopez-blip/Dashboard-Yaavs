import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import {
  ASSIGNMENT_STATUS_LABELS,
  PRIORITY_LABELS,
} from '../constants';
import { AssignmentBriefDetails } from './AssignmentBriefDetails';
import { FileAttachmentsEditor, FileAttachmentsList } from './FileAttachments';
import { SpellCheckInput, SpellCheckTextarea } from './SpellCheckField';
import { fuzzyIncludes } from '../utils/fuzzyMatch';
import { assignableMarketingTasks, assignmentTaskLine } from '../utils/assignmentBrief';
import { loadAssignmentAttachments } from '../utils/attachmentStore';
import {
  filterPendingAssignments,
  isPendingAssignment,
} from '../utils/activeItems';
import {
  BUSINESS_UNITS,
  labelFor,
  PROJECT_TYPES,
  REQUESTING_DEPARTMENTS,
} from '../data/projectOptions';
import { useWorkloadGuard } from '../hooks/useWorkloadGuard';
import { workloadLabel } from '../utils/workloadLimits';
import { WorkloadLimitsPanel } from './WorkloadLimitsPanel';
import { WorkloadOverrideModal } from './WorkloadOverrideModal';
import { EmployeeMultiSelect } from './EmployeeMultiSelect';
import type { FileAttachment, TaskAssignment } from '../types';
import './AssignmentsView.css';

export function AssignmentsView() {
  const {
    user,
    board,
    canEditAll,
    canManageWorkloadLimits,
    activeUsers,
    assignments,
    myPendingAssignments,
    getWorkloadCheck,
    acceptAssignment,
    rejectAssignment,
    cancelAssignment,
    deleteAssignment,
    assignmentSearch,
    setAssignmentSearch,
  } = useApp();
  const toast = useToast();
  const { override, cancelOverride, confirmOverride, submitAssignment } = useWorkloadGuard();

  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [dueDate, setDueDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [priority, setPriority] = useState<'baja' | 'media' | 'alta'>('media');
  const [notes, setNotes] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);

  const assignable = useMemo(
    () => assignableMarketingTasks(board.tasks, activeUsers),
    [board.tasks, activeUsers],
  );

  /**
   * Evita mostrar dos veces la misma indicación para el mismo colaborador
   * (por ejemplo, si un envío se duplicó durante la sincronización).
   */
  const dedupeByRecipient = (list: TaskAssignment[]) => {
    const seen = new Set<string>();
    return list.filter((a) => {
      const key = `${a.employeeId}|${a.title.trim().toLowerCase()}|${a.dueDate}|${a.status}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const filterList = (list: TaskAssignment[]) => {
    const q = assignmentSearch.trim();
    if (!q) return list;
    return list.filter((a) => {
      if (
        fuzzyIncludes(a.title, q) ||
        fuzzyIncludes(a.employeeName, q) ||
        fuzzyIncludes(a.assignedByName, q)
      ) {
        return true;
      }
      const b = a.brief;
      if (!b) return false;
      return (
        fuzzyIncludes(b.projectName, q) ||
        fuzzyIncludes(b.requestedBy, q) ||
        fuzzyIncludes(labelFor(BUSINESS_UNITS, b.businessUnit), q) ||
        fuzzyIncludes(labelFor(REQUESTING_DEPARTMENTS, b.requestingDepartment), q) ||
        fuzzyIncludes(labelFor(PROJECT_TYPES, b.projectType), q)
      );
    });
  };

  const managerList = useMemo(() => {
    if (!canEditAll) return [];
    return dedupeByRecipient(
      filterList(
        filterPendingAssignments(assignments).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      ),
    );
  }, [assignments, canEditAll, assignmentSearch]);

  const myHistory = useMemo(() => {
    if (!user?.employeeId) return [];
    return filterList(
      assignments
        .filter((a) => a.employeeId === user.employeeId && a.status !== 'pending')
        .sort(
          (a, b) =>
            new Date(b.respondedAt || b.createdAt).getTime() -
            new Date(a.respondedAt || a.createdAt).getTime(),
        )
        .slice(0, 20),
    );
  }, [assignments, user?.employeeId, assignmentSearch]);

  const managerResponses = useMemo(() => {
    if (!canEditAll) return [];
    return filterList(
      assignments
        .filter((a) => a.status === 'accepted' || a.status === 'rejected')
        .sort(
          (a, b) =>
            new Date(b.respondedAt || b.createdAt).getTime() -
            new Date(a.respondedAt || a.createdAt).getTime(),
        )
        .slice(0, 15),
    );
  }, [assignments, canEditAll, assignmentSearch]);

  const selectedWorkload = useMemo(() => {
    if (employeeIds.length !== 1) return null;
    return getWorkloadCheck(employeeIds[0], { addSlots: 1 });
  }, [employeeIds, getWorkloadCheck, assignments]);

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    if (!employeeIds.length || !title.trim()) return;
    const payload = {
      employeeIds,
      title,
      objective,
      dueDate,
      priority,
      notes,
      attachmentUrl,
      attachments: attachments.length ? attachments : undefined,
    };
    const fileCount = attachments.length;
    submitAssignment(payload, () => {
      setTitle('');
      setObjective('');
      setNotes('');
      setAttachmentUrl('');
      setAttachments([]);
      setEmployeeIds([]);
      const count = employeeIds.length;
      toast.success(
        fileCount > 0
          ? `Indicación enviada a ${count} colaborador${count > 1 ? 'es' : ''} con ${fileCount} archivo${fileCount > 1 ? 's' : ''}`
          : `Indicación enviada a ${count} colaborador${count > 1 ? 'es' : ''}`,
      );
    });
  };

  const handleAccept = (id: string) => {
    acceptAssignment(id);
    toast.success('Indicación aceptada. Ya está en tu tablero.');
  };

  const submitReject = () => {
    if (!rejectingId) return;
    rejectAssignment(rejectingId, rejectReason);
    toast.info('Indicación rechazada');
    setRejectingId(null);
    setRejectReason('');
  };

  return (
    <div className="assignments-view">
      {canManageWorkloadLimits && <WorkloadLimitsPanel />}

      <input
        type="search"
        className="assign-search"
        placeholder="Buscar indicaciones…"
        value={assignmentSearch}
        onChange={(e) => setAssignmentSearch(e.target.value)}
      />

      {!canEditAll && myPendingAssignments.length > 0 && (
        <section className="assign-section assign-inbox">
          <h2>
            Indicaciones nuevas
            <span className="assign-badge">{myPendingAssignments.length}</span>
          </h2>
          <p className="assign-hint">
            Tu gerente te envió trabajo por hacer. Revísalo y acéptalo para que
            aparezca en tu tablero.
          </p>
          <ul className="assign-list">
            {dedupeByRecipient(myPendingAssignments).map((a) => (
              <AssignmentCard
                key={a.id}
                assignment={a}
                showActions
                onAccept={() => handleAccept(a.id)}
                onReject={() => setRejectingId(a.id)}
              />
            ))}
          </ul>
        </section>
      )}

      {canEditAll && (
        <div className="assign-manager-layout">
          <section className="assign-section assign-compose">
            <h2>Nueva indicación</h2>
            <form className="assign-form assign-form--composer" onSubmit={handleSend}>
              <label className="assign-field">
                Para
                <EmployeeMultiSelect
                  assignable={assignable}
                  values={employeeIds}
                  onChange={setEmployeeIds}
                  variant="chips"
                />
                {selectedWorkload && (
                  <span
                    className={`assign-workload-hint${selectedWorkload.allowed ? '' : ' assign-workload-hint--full'}`}
                  >
                    Carga: {workloadLabel(selectedWorkload)} ·{' '}
                    {selectedWorkload.current.projects} proyecto
                    {selectedWorkload.current.projects === 1 ? '' : 's'}
                    {!selectedWorkload.allowed && ' — límite (pedirá contraseña)'}
                  </span>
                )}
              </label>
              <label className="assign-field assign-field--main">
                Qué debe hacer
                <SpellCheckTextarea
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  rows={3}
                  required
                  placeholder="Describe la tarea con claridad…"
                />
              </label>
              <label className="assign-field">
                Objetivo
                <SpellCheckInput
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="Resultado esperado (opcional)"
                />
              </label>
              <div className="assign-composer-bar">
                <label className="assign-field">
                  Fecha
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                  />
                </label>
                <label className="assign-field">
                  Prioridad
                  <select
                    value={priority}
                    onChange={(e) =>
                      setPriority(e.target.value as 'baja' | 'media' | 'alta')
                    }
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                  </select>
                </label>
                <button type="submit" className="btn-primary assign-composer-send">
                  Enviar
                </button>
              </div>
              <div className="assign-more">
                <button
                  type="button"
                  className="assign-more-toggle"
                  aria-expanded={moreOpen}
                  onClick={() => setMoreOpen((v) => !v)}
                >
                  {moreOpen ? 'Ocultar opciones' : 'Más opciones'}
                  {(attachments.length > 0 || notes.trim() || attachmentUrl.trim()) && (
                    <span className="assign-more-dot" aria-hidden="true" />
                  )}
                </button>
                {moreOpen && (
                  <div className="assign-more-body">
                    <div className="assign-attachments-field assign-attachments-field--slim">
                      <span className="assign-attachments-field-label">Archivos</span>
                      <FileAttachmentsEditor
                        attachments={attachments}
                        onChange={setAttachments}
                        onError={(msg) => toast.info(msg)}
                        onSuccess={(msg) => toast.success(msg)}
                        enableLibrary
                      />
                    </div>
                    <label className="assign-field">
                      Enlace (Figma, Drive…)
                      <input
                        type="url"
                        value={attachmentUrl}
                        onChange={(e) => setAttachmentUrl(e.target.value)}
                        placeholder="https://…"
                      />
                    </label>
                    <label className="assign-field">
                      Notas
                      <SpellCheckTextarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        placeholder="Contexto extra (opcional)"
                      />
                    </label>
                  </div>
                )}
              </div>
            </form>
          </section>

          <section className="assign-section assign-pending-panel">
            <h2>
              Pendientes
              {managerList.length > 0 && (
                <span className="assign-badge">{managerList.length}</span>
              )}
            </h2>
            {managerList.length === 0 ? (
              <p className="assign-empty">Nada pendiente de aceptar.</p>
            ) : (
              <ul className="assign-list assign-list--scroll assign-list--inbox">
                {managerList.map((a) => (
                  <AssignmentCard
                    key={a.id}
                    assignment={a}
                    compact
                    canCancel={isPendingAssignment(a)}
                    onCancel={() => {
                      cancelAssignment(a.id);
                      toast.info('Indicación cancelada');
                    }}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {!canEditAll && myHistory.length > 0 && (
        <section className="assign-section">
          <h2>Respondidas</h2>
          <p className="assign-hint">
            Historial de lo que ya aceptaste o rechazaste. Puedes borrarlo si ya no lo necesitas.
          </p>
          <ul className="assign-list">
            {myHistory.map((a) => (
              <AssignmentCard
                key={a.id}
                assignment={a}
                canDelete
                onDelete={() => {
                  deleteAssignment(a.id);
                  toast.info('Indicación eliminada del historial');
                }}
              />
            ))}
          </ul>
        </section>
      )}

      {canEditAll && managerResponses.length > 0 && (
        <section className="assign-section">
          <h2>Respuestas del equipo</h2>
          <p className="assign-hint">
            Indicaciones que el equipo ya aceptó o rechazó. Puedes eliminarlas del historial.
          </p>
          <ul className="assign-list">
            {managerResponses.map((a) => (
              <AssignmentCard
                key={a.id}
                assignment={a}
                canDelete
                onDelete={() => {
                  deleteAssignment(a.id);
                  toast.info('Indicación eliminada del historial');
                }}
              />
            ))}
          </ul>
        </section>
      )}

      {rejectingId && (
        <div className="reject-overlay" role="presentation">
          <div className="reject-panel">
            <h3>¿Por qué rechazas esta indicación?</h3>
            <SpellCheckTextarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Opcional: explica el motivo al gerente"
            />
            <div className="reject-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setRejectingId(null)}
              >
                Volver
              </button>
              <button type="button" className="btn-danger" onClick={submitReject}>
                Confirmar rechazo
              </button>
            </div>
          </div>
        </div>
      )}

      {override && (
        <WorkloadOverrideModal
          check={override.check}
          onClose={cancelOverride}
          onConfirm={confirmOverride}
        />
      )}
    </div>
  );
}

function AssignmentCard({
  assignment,
  showActions,
  canCancel,
  canDelete,
  defaultExpanded = false,
  compact = false,
  onAccept,
  onReject,
  onCancel,
  onDelete,
}: {
  assignment: TaskAssignment;
  showActions?: boolean;
  canCancel?: boolean;
  canDelete?: boolean;
  defaultExpanded?: boolean;
  compact?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [loadedFiles, setLoadedFiles] = useState<FileAttachment[]>([]);

  useEffect(() => {
    if (assignment.attachments?.length) return;
    let cancelled = false;
    void loadAssignmentAttachments(assignment.id).then((list) => {
      if (!cancelled) setLoadedFiles(list);
    });
    return () => {
      cancelled = true;
    };
  }, [assignment.id, assignment.attachments]);

  const files = assignment.attachments?.length
    ? assignment.attachments
    : loadedFiles;

  const date = new Date(assignment.createdAt).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const dueLabel = (() => {
    const raw = assignment.dueDate?.trim();
    if (!raw) return 'Sin fecha';
    const parsed = new Date(`${raw}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return raw;
    return parsed.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
    });
  })();

  const titleText =
    assignment.title.trim() ||
    assignment.objective?.trim() ||
    assignment.brief?.projectName?.trim() ||
    'Sin título';

  const avatar = (() => {
    const parts = assignment.employeeName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  })();

  return (
    <li
      className={`assign-card status-${assignment.status}${expanded ? ' assign-card--open' : ''}${compact ? ' assign-card--compact' : ''}`}
    >
      <button
        type="button"
        className="assign-card-header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {compact && assignment.status === 'pending' && (
          <span className="assign-card-pending-dot" title="Pendiente" aria-hidden="true" />
        )}
        {compact && (
          <span className="assign-card-avatar" aria-hidden="true">
            {avatar}
          </span>
        )}
        <div className="assign-card-header-main">
          {!compact && (
            <div className="assign-card-top">
              <span className={`assign-status assign-status-${assignment.status}`}>
                {ASSIGNMENT_STATUS_LABELS[assignment.status]}
              </span>
              <span className="assign-priority">
                {PRIORITY_LABELS[assignment.priority]}
              </span>
            </div>
          )}
          <h3>{titleText}</h3>
          <p className="assign-card-subtitle">
            {compact ? (
              <>
                <strong>{assignment.employeeName}</strong>
                <span className="assign-card-dot">·</span>
                {dueLabel}
                <span className="assign-card-dot">·</span>
                <span className={`assign-priority-chip assign-priority-chip--${assignment.priority}`}>
                  {PRIORITY_LABELS[assignment.priority]}
                </span>
              </>
            ) : (
              <>
                Para <strong>{assignment.employeeName}</strong> · Entrega{' '}
                {assignment.dueDate}
              </>
            )}
          </p>
        </div>
        <span className="assign-card-chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {expanded && (
        <div className="assign-card-body">
          {assignment.brief ? (
            <AssignmentBriefDetails brief={assignment.brief} />
          ) : null}
          {files.length > 0 && (
            <div className="assign-attachments-block">
              <p className="assign-attachments-label">Archivos adjuntos</p>
              <FileAttachmentsList attachments={files} />
            </div>
          )}
          {(() => {
            const taskLine = assignmentTaskLine(assignment.objective);
            return taskLine ? (
              <p className="assign-task-line">
                <span className="assign-task-label">Qué debes hacer</span>
                {taskLine}
              </p>
            ) : null;
          })()}
          {!assignment.brief && assignment.objective && (
            <p className="assign-objective">{assignment.objective}</p>
          )}
          {assignment.attachmentUrl && (
            <a
              href={assignment.attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="assign-link"
              onClick={(e) => e.stopPropagation()}
            >
              Ver material de referencia →
            </a>
          )}
          <div className="assign-meta">
            <span>
              Para: <strong>{assignment.employeeName}</strong>
            </span>
            <span>
              De: <strong>{assignment.assignedByName}</strong>
            </span>
            <span>Entrega: {assignment.dueDate}</span>
            <span>Enviada: {date}</span>
          </div>
          {assignment.rejectReason && (
            <p className="assign-reject-reason">
              Motivo de rechazo: {assignment.rejectReason}
            </p>
          )}
          {assignment.notes && <p className="assign-notes">{assignment.notes}</p>}
        </div>
      )}
      {showActions && (
        <div className="assign-actions">
          {!expanded && (
            <button
              type="button"
              className="btn-ghost assign-view-details"
              onClick={() => setExpanded(true)}
            >
              Ver detalles
            </button>
          )}
          <button type="button" className="btn-primary" onClick={onAccept}>
            Aceptar
          </button>
          <button type="button" className="btn-ghost" onClick={onReject}>
            Rechazar
          </button>
        </div>
      )}
      {canCancel && expanded && (
        <button type="button" className="btn-ghost assign-cancel" onClick={onCancel}>
          Cancelar indicación
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          className="btn-ghost assign-delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
        >
          Eliminar del historial
        </button>
      )}
    </li>
  );
}
