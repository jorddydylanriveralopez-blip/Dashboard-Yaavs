import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  loadAssignmentAttachments,
  loadProjectAttachments,
} from '../utils/attachmentStore';
import type { FileAttachment } from '../types';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import {
  ASSIGNMENT_STATUS_LABELS,
  PRIORITY_LABELS,
} from '../constants';
import { AssignmentBriefDetails } from './AssignmentBriefDetails';
import { FileAttachmentsEditor, FileAttachmentsList } from './FileAttachments';
import { cloneAttachments } from '../utils/fileAttachments';
import { SpellCheckInput, SpellCheckTextarea } from './SpellCheckField';
import { fuzzyIncludes } from '../utils/fuzzyMatch';
import {
  assignableMarketingTasks,
  assignmentPriorityFromProject,
  assignmentTaskLine,
  briefFromProject,
  buildObjectiveFromProject,
  employeeIdForCollaborator,
} from '../utils/assignmentBrief';
import {
  filterPendingAssignments,
  isActiveProject,
  isPendingAssignment,
} from '../utils/activeItems';
import {
  BUSINESS_UNITS,
  COLLABORATORS,
  labelFor,
  PROJECT_TYPES,
  REQUESTING_DEPARTMENTS,
} from '../data/projectOptions';
import type { TaskAssignment } from '../types';
import './AssignmentsView.css';

export function AssignmentsView() {
  const {
    user,
    board,
    canEditAll,
    activeUsers,
    projects,
    assignments,
    myPendingAssignments,
    createAssignment,
    acceptAssignment,
    rejectAssignment,
    cancelAssignment,
    assignmentSearch,
    setAssignmentSearch,
  } = useApp();
  const toast = useToast();

  const [employeeId, setEmployeeId] = useState('');
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [dueDate, setDueDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [priority, setPriority] = useState<'baja' | 'media' | 'alta'>('media');
  const [notes, setNotes] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [linkedProjectId, setLinkedProjectId] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const assignable = useMemo(
    () => assignableMarketingTasks(board.tasks, activeUsers),
    [board.tasks, activeUsers],
  );

  const linkableProjects = useMemo(
    () => projects.filter(isActiveProject),
    [projects],
  );

  useEffect(() => {
    if (!linkedProjectId) return;
    const proj = linkableProjects.find((p) => p.id === linkedProjectId);
    if (!proj) return;
    setTitle(proj.projectName);
    setObjective(buildObjectiveFromProject(proj));
    setDueDate(proj.commitmentDate || new Date().toISOString().slice(0, 10));
    setPriority(assignmentPriorityFromProject(proj.priority));
    const empId = employeeIdForCollaborator(proj.collaborator, activeUsers);
    if (empId) setEmployeeId(empId);
    void loadProjectAttachments(proj.id).then((fromDb) => {
      const list =
        fromDb.length > 0 ? fromDb : (proj.attachments?.length ? proj.attachments! : []);
      setAttachments(cloneAttachments(list));
    });
  }, [linkedProjectId, linkableProjects, activeUsers]);

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
    return filterList(
      filterPendingAssignments(assignments).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    );
  }, [assignments, canEditAll, assignmentSearch]);

  const myHistory = useMemo(() => {
    if (!user?.employeeId) return [];
    return filterList(
      filterPendingAssignments(
        assignments.filter((a) => a.employeeId === user.employeeId),
      ).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    );
  }, [assignments, user?.employeeId, assignmentSearch]);

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    if (!employeeId || !title.trim()) return;
    const proj = linkedProjectId
      ? linkableProjects.find((p) => p.id === linkedProjectId)
      : undefined;
    createAssignment({
      employeeId,
      title,
      objective,
      dueDate,
      priority,
      notes,
      attachmentUrl,
      attachments: attachments.length ? attachments : undefined,
      brief: proj ? briefFromProject(proj) : undefined,
    });
    setTitle('');
    setObjective('');
    setNotes('');
    setAttachmentUrl('');
    setAttachments([]);
    setLinkedProjectId('');
    const fileCount = attachments.length;
    toast.success(
      fileCount > 0
        ? `Indicación enviada con ${fileCount} archivo${fileCount > 1 ? 's' : ''} adjunto${fileCount > 1 ? 's' : ''}`
        : 'Indicación enviada al colaborador (sin archivos adjuntos)',
    );
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
            {myPendingAssignments.map((a) => (
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
        <section className="assign-section">
          <h2>Enviar indicación al equipo</h2>
          <p className="assign-hint">
            Vincula un proyecto creativo para que el colaborador vea solicitud, área,
            unidad de negocio y el resto del contexto.
          </p>
          <form className="assign-form" onSubmit={handleSend}>
            <label>
              Proyecto creativo (origen de la solicitud)
              <select
                value={linkedProjectId}
                onChange={(e) => setLinkedProjectId(e.target.value)}
              >
                <option value="">Sin vincular / indicación manual</option>
                {linkableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectName} — {labelFor(COLLABORATORS, p.collaborator)}
                  </option>
                ))}
              </select>
            </label>
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
                    {t.employeeName} — {t.roleTitle}
                  </option>
                ))}
              </select>
            </label>
            <div className="assign-attachments-field">
              <span className="assign-attachments-field-label">Archivos e imágenes</span>
              <p className="assign-attachments-field-hint">
                Adjunta briefs, mockups o PDFs. El colaborador los verá en la indicación.
              </p>
              <FileAttachmentsEditor
                attachments={attachments}
                onChange={setAttachments}
                onError={(msg) => toast.info(msg)}
                onSuccess={(msg) => toast.success(msg)}
              />
            </div>
            <label>
              Qué debe hacer
              <SpellCheckTextarea
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                rows={2}
                required
              />
            </label>
            <label>
              Objetivo
              <SpellCheckInput value={objective} onChange={(e) => setObjective(e.target.value)} />
            </label>
            <div className="assign-form-row">
              <label>
                Fecha límite
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </label>
              <label>
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
            </div>
            <label>
              Enlace externo (Figma, Drive…)
              <input
                type="url"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                placeholder="https://…"
              />
            </label>
            <label>
              Notas
              <SpellCheckTextarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </label>
            <button type="submit" className="btn-primary">
              Enviar indicación
            </button>
          </form>
        </section>
      )}

      {canEditAll && (
        <section className="assign-section">
          <h2>Indicaciones pendientes</h2>
          <p className="assign-hint">
            Al aceptar, rechazar o cancelar, la indicación desaparece del listado.
          </p>
          {managerList.length === 0 ? (
            <p className="assign-empty">No hay indicaciones pendientes.</p>
          ) : (
            <ul className="assign-list">
              {managerList.map((a) => (
                <AssignmentCard
                  key={a.id}
                  assignment={a}
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
      )}

      {!canEditAll && myHistory.length > 0 && (
        <section className="assign-section">
          <h2>Pendientes anteriores</h2>
          <ul className="assign-list">
            {myHistory.map((a) => (
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
    </div>
  );
}

function AssignmentCard({
  assignment,
  showActions,
  canCancel,
  onAccept,
  onReject,
  onCancel,
}: {
  assignment: TaskAssignment;
  showActions?: boolean;
  canCancel?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
}) {
  const [files, setFiles] = useState<FileAttachment[]>(assignment.attachments ?? []);

  useEffect(() => {
    if (assignment.attachments?.length) {
      setFiles(assignment.attachments);
      return;
    }
    let cancelled = false;
    void loadAssignmentAttachments(assignment.id).then((list) => {
      if (!cancelled) setFiles(list);
    });
    return () => {
      cancelled = true;
    };
  }, [assignment.id, assignment.attachments]);

  const date = new Date(assignment.createdAt).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <li className={`assign-card status-${assignment.status}`}>
      <div className="assign-card-top">
        <span className={`assign-status assign-status-${assignment.status}`}>
          {ASSIGNMENT_STATUS_LABELS[assignment.status]}
        </span>
        <span className="assign-priority">{PRIORITY_LABELS[assignment.priority]}</span>
      </div>
      <h3>{assignment.title}</h3>
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
      {showActions && (
        <div className="assign-actions">
          <button type="button" className="btn-primary" onClick={onAccept}>
            Aceptar
          </button>
          <button type="button" className="btn-ghost" onClick={onReject}>
            Rechazar
          </button>
        </div>
      )}
      {canCancel && (
        <button type="button" className="btn-ghost assign-cancel" onClick={onCancel}>
          Cancelar indicación
        </button>
      )}
    </li>
  );
}
