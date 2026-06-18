import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useApp } from '../context/AppContext';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import {
  assignableMarketingTasks,
  assignmentPriorityFromProject,
  briefFromProject,
  buildObjectiveFromProject,
  employeeIdForCollaborator,
} from '../utils/assignmentBrief';
import {
  BUSINESS_UNITS,
  COLLABORATORS,
  INTERNAL_AREAS,
  labelFor,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  PROJECT_STATUS_COLORS,
  PROJECT_TYPES,
  REQUESTING_DEPARTMENTS,
} from '../data/projectOptions';
import { formatLongDate, formatShortDate } from '../utils/formatDate';
import { calcProjectDurationDays, formatDuration } from '../utils/projectDuration';
import {
  canEmployeeCompleteProject,
  canEmployeeSetCommitmentDate,
} from '../utils/collaboratorMap';
import { FileAttachmentsEditor, FileAttachmentsList } from './FileAttachments';
import { SpellCheckInput, SpellCheckTextarea } from './SpellCheckField';
import {
  deleteProjectCompletionProof,
  loadProjectAttachments,
  loadProjectCompletionProof,
  saveProjectCompletionProof,
} from '../utils/attachmentStore';
import { persistProjectAttachments } from '../utils/persistAttachments';
import {
  cloneAttachments,
  guessMimeType,
  isImageAttachment,
  readFileAsAttachment,
} from '../utils/fileAttachments';
import type { CreativeProject, FileAttachment } from '../types';
import './ProjectDetailModal.css';

interface Props {
  projectId: string;
  onClose: () => void;
  /** Al abrir desde Inicio → Trabajo concluido, enfoca la sección de entrega. */
  focusCompletion?: boolean;
}

function ReadOnly({ children }: { children: ReactNode }) {
  return <p className="project-readonly">{children}</p>;
}

export function ProjectDetailModal({ projectId, onClose, focusCompletion }: Props) {
  const {
    user,
    canEditAll,
    board,
    updateProject,
    deleteProject,
    createAssignment,
    activeUsers,
  } = useApp();
  const { confirm } = useConfirm();
  const toast = useToast();
  const [assignToId, setAssignToId] = useState('');
  const [projectAttachments, setProjectAttachments] = useState<FileAttachment[]>([]);
  const [completionProof, setCompletionProof] = useState<FileAttachment | null>(null);
  const [proofBusy, setProofBusy] = useState(false);
  const [completeBusy, setCompleteBusy] = useState(false);
  const attachmentsTouchedRef = useRef(false);
  const proofInputRef = useRef<HTMLInputElement>(null);
  const completionSectionRef = useRef<HTMLElement>(null);

  const p = useMemo(
    () => (board.projects ?? []).find((x) => x.id === projectId),
    [board.projects, projectId],
  );

  const assignable = useMemo(
    () => assignableMarketingTasks(board.tasks, activeUsers),
    [board.tasks, activeUsers],
  );

  useEffect(() => {
    if (!p) onClose();
  }, [p, onClose]);

  const projectCollaborator = p?.collaborator;

  useEffect(() => {
    if (projectCollaborator === undefined) return;
    const defaultId = employeeIdForCollaborator(projectCollaborator, activeUsers);
    setAssignToId(defaultId ?? '');
  }, [projectId, projectCollaborator, activeUsers]);

  useEffect(() => {
    attachmentsTouchedRef.current = false;
    let cancelled = false;
    void loadProjectAttachments(projectId).then((files) => {
      if (!cancelled && !attachmentsTouchedRef.current) setProjectAttachments(files);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    void loadProjectCompletionProof(projectId).then((proof) => {
      if (!cancelled) setCompletionProof(proof);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleProjectAttachmentsChange = (attachments: FileAttachment[]) => {
    attachmentsTouchedRef.current = true;
    setProjectAttachments(attachments);
    void (async () => {
      try {
        await persistProjectAttachments(projectId, attachments, (id, patch) =>
          updateProject(id, patch),
        );
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : 'No se pudo guardar en el disco del navegador, pero puedes seguir viendo la vista previa.',
        );
      }
    })();
  };

  const canCompleteWorkFlag = p ? canEmployeeCompleteProject(p, user, canEditAll) : false;

  useEffect(() => {
    if (!focusCompletion || !p || !canCompleteWorkFlag) return;
    const t = window.setTimeout(() => {
      completionSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
    return () => window.clearTimeout(t);
  }, [focusCompletion, canCompleteWorkFlag, projectId, p]);

  if (!p) return null;

  const managerEditable = canEditAll;
  const canSetCommitment = canEmployeeSetCommitmentDate(p, user, canEditAll);
  const canCompleteWork = canCompleteWorkFlag;
  const isFinished = p.status === 'terminado';

  const handleProofFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const mime = guessMimeType(file);
    if (!isImageAttachment(mime)) {
      toast.error('La prueba debe ser una imagen (captura o foto del trabajo terminado).');
      return;
    }
    setProofBusy(true);
    try {
      const att = await readFileAsAttachment(file);
      await saveProjectCompletionProof(projectId, att);
      setCompletionProof(att);
      updateProject(projectId, { hasCompletionProof: true });
      toast.success('Prueba de entrega guardada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar la imagen');
    } finally {
      setProofBusy(false);
    }
  };

  const handleRemoveProof = async () => {
    const ok = await confirm({
      title: 'Quitar prueba',
      message: '¿Quitar la foto de entrega? No podrás marcar el trabajo concluido sin ella.',
      confirmLabel: 'Quitar',
      danger: true,
    });
    if (!ok) return;
    await deleteProjectCompletionProof(projectId);
    setCompletionProof(null);
    updateProject(projectId, { hasCompletionProof: false });
    toast.info('Prueba eliminada');
  };

  const handleCompleteWork = async () => {
    if (!completionProof) {
      toast.error('Sube primero una imagen del trabajo terminado.');
      proofInputRef.current?.click();
      return;
    }
    const ok = await confirm({
      title: 'Trabajo concluido',
      message: `¿Marcar «${p.projectName.trim() || 'este proyecto'}» como terminado? Se moverá a Concluidos.`,
      confirmLabel: 'Sí, concluir',
    });
    if (!ok) return;
    setCompleteBusy(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      updateProject(projectId, {
        status: 'terminado',
        finishedDate: p.finishedDate ?? today,
        hasCompletionProof: true,
        completedAt: new Date().toISOString(),
        completedByName: user?.name ?? user?.username,
      });
      toast.success('Trabajo marcado como concluido');
      onClose();
    } finally {
      setCompleteBusy(false);
    }
  };
  const duration = calcProjectDurationDays(p.requestDate, p.finishedDate, p.status);
  const durationToCommitment = calcProjectDurationDays(
    p.requestDate,
    p.commitmentDate,
    undefined,
  );

  const field = (label: string, content: ReactNode, fullWidth = false) => (
    <section className={`project-field${fullWidth ? ' project-field--full' : ''}`}>
      <label>{label}</label>
      {content}
    </section>
  );

  const displayName = p.projectName.trim() || 'Sin nombre';

  const handleEmployeeCommitment = (date: string) => {
    if (!date || p.commitmentDateLocked) return;
    updateProject(p.id, {
      commitmentDate: date,
      commitmentDateLocked: true,
    });
  };

  const commitmentField = managerEditable ? (
    <input
      type="date"
      value={p.commitmentDate}
      onChange={(e) => updateProject(p.id, { commitmentDate: e.target.value })}
    />
  ) : canSetCommitment ? (
    <>
      <input
        type="date"
        value={p.commitmentDate}
        onChange={(e) => handleEmployeeCommitment(e.target.value)}
      />
      <p className="field-hint">
        Define tu fecha de entrega. <strong>Solo puedes guardarla una vez</strong>; después
        quedará bloqueada.
      </p>
    </>
  ) : (
    <>
      <ReadOnly>{formatShortDate(p.commitmentDate)}</ReadOnly>
      {p.commitmentDateLocked ? (
        <p className="field-hint">Fecha de compromiso fijada (ya no se puede cambiar).</p>
      ) : (
        <p className="field-hint field-hint-warn">
          Solo el colaborador asignado puede definir la fecha de compromiso.
        </p>
      )}
    </>
  );

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-panel project-detail-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <header className="modal-header">
          <div>
            <h2>{displayName}</h2>
            <span
              className={`status-pill-project status-pill-project--${p.status}`}
              style={
                { '--status-color': PROJECT_STATUS_COLORS[p.status] } as CSSProperties
              }
            >
              {labelFor(PROJECT_STATUSES, p.status)}
            </span>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className="project-live-summary" aria-live="polite">
          <div className="project-live-item">
            <span className="project-live-label">Fecha de compromiso</span>
            <strong>{formatLongDate(p.commitmentDate)}</strong>
            <span className="project-live-sub">
              {formatShortDate(p.commitmentDate)}
              {durationToCommitment !== null && (
                <> · {formatDuration(durationToCommitment)} desde solicitud</>
              )}
            </span>
          </div>
          <div className="project-live-item">
            <span className="project-live-label">Fecha de finalizado</span>
            <strong>{p.finishedDate ? formatLongDate(p.finishedDate) : 'Sin definir'}</strong>
            {p.finishedDate && (
              <span className="project-live-sub">{formatShortDate(p.finishedDate)}</span>
            )}
          </div>
          <div className="project-live-item">
            <span className="project-live-label">Duración del proyecto</span>
            <strong className="duration-big">{formatDuration(duration)}</strong>
          </div>
        </div>

        {!managerEditable && (
          <p className="field-hint" style={{ padding: '0 24px 8px', margin: 0 }}>
            Puedes consultar todos los datos del proyecto. Solo editas tu fecha de compromiso
            (una vez).
          </p>
        )}

        <div className="project-detail-body">
          <div className="project-detail-grid">
            {field(
              'Nombre del proyecto',
              managerEditable ? (
                <SpellCheckInput
                  value={p.projectName}
                  onChange={(e) => updateProject(p.id, { projectName: e.target.value })}
                  autoFix={false}
                  placeholder="Ej. Campaña lanzamiento verano"
                  autoFocus={!p.projectName.trim()}
                  extraWords={[p.requestedBy]}
                />
              ) : (
                <ReadOnly>
                  <strong>{displayName}</strong>
                </ReadOnly>
              ),
              true,
            )}
            {field(
              'Fecha de solicitud',
              managerEditable ? (
                <input
                  type="date"
                  value={p.requestDate}
                  onChange={(e) => updateProject(p.id, { requestDate: e.target.value })}
                />
              ) : (
                <ReadOnly>{formatShortDate(p.requestDate)}</ReadOnly>
              ),
            )}
            {field(
              'Unidad de negocio',
              managerEditable ? (
                <select
                  value={p.businessUnit}
                  onChange={(e) =>
                    updateProject(p.id, {
                      businessUnit: e.target.value as CreativeProject['businessUnit'],
                    })
                  }
                >
                  {BUSINESS_UNITS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <ReadOnly>{labelFor(BUSINESS_UNITS, p.businessUnit)}</ReadOnly>
              ),
            )}
            {field(
              'Solicitado por',
              managerEditable ? (
                <SpellCheckInput
                  value={p.requestedBy}
                  autoFix={false}
                  extraWords={[p.projectName, p.requestedBy]}
                  onChange={(e) => updateProject(p.id, { requestedBy: e.target.value })}
                />
              ) : (
                <ReadOnly>{p.requestedBy || '—'}</ReadOnly>
              ),
            )}
            {field(
              'Área solicitante',
              managerEditable ? (
                <select
                  value={p.requestingDepartment}
                  onChange={(e) =>
                    updateProject(p.id, {
                      requestingDepartment: e.target
                        .value as CreativeProject['requestingDepartment'],
                    })
                  }
                >
                  {REQUESTING_DEPARTMENTS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <ReadOnly>{labelFor(REQUESTING_DEPARTMENTS, p.requestingDepartment)}</ReadOnly>
              ),
            )}
            {field(
              'Tipo de proyecto',
              managerEditable ? (
                <select
                  value={p.projectType}
                  onChange={(e) =>
                    updateProject(p.id, {
                      projectType: e.target.value as CreativeProject['projectType'],
                    })
                  }
                >
                  {PROJECT_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <ReadOnly>{labelFor(PROJECT_TYPES, p.projectType)}</ReadOnly>
              ),
            )}
            {field(
              'Prioridad',
              managerEditable ? (
                <div className="priority-picker" role="radiogroup" aria-label="Prioridad">
                  {PROJECT_PRIORITIES.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={p.priority === o.value}
                      className={`priority-picker-btn priority-picker-btn--${o.value} ${p.priority === o.value ? 'is-active' : ''}`}
                      onClick={() =>
                        updateProject(p.id, {
                          priority: o.value,
                        })
                      }
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="project-field-badge-wrap">
                  <span className={`priority-badge priority-badge--${p.priority}`}>
                    {labelFor(PROJECT_PRIORITIES, p.priority)}
                  </span>
                </div>
              ),
            )}
            {field('Fecha de compromiso', commitmentField)}
            {field(
              'Área interna',
              managerEditable ? (
                <select
                  value={p.internalArea}
                  onChange={(e) =>
                    updateProject(p.id, {
                      internalArea: e.target.value as CreativeProject['internalArea'],
                    })
                  }
                >
                  {INTERNAL_AREAS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <ReadOnly>{labelFor(INTERNAL_AREAS, p.internalArea)}</ReadOnly>
              ),
            )}
            {field(
              'Colaborador',
              managerEditable ? (
                <select
                  value={p.collaborator}
                  onChange={(e) =>
                    updateProject(p.id, {
                      collaborator: e.target.value as CreativeProject['collaborator'],
                    })
                  }
                >
                  {COLLABORATORS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <ReadOnly>{labelFor(COLLABORATORS, p.collaborator)}</ReadOnly>
              ),
            )}
            {field(
              'Status',
              managerEditable ? (
                <select
                  value={p.status}
                  onChange={(e) => {
                    const status = e.target.value as CreativeProject['status'];
                    if (status === 'terminado') {
                      updateProject(p.id, {
                        status,
                        finishedDate:
                          p.finishedDate ?? new Date().toISOString().slice(0, 10),
                      });
                      onClose();
                      return;
                    }
                    updateProject(p.id, { status });
                  }}
                >
                  {PROJECT_STATUSES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <ReadOnly>{labelFor(PROJECT_STATUSES, p.status)}</ReadOnly>
              ),
            )}
            {field(
              'Fecha de finalizado',
              managerEditable ? (
                <input
                  type="date"
                  value={p.finishedDate ?? ''}
                  onChange={(e) =>
                    updateProject(p.id, {
                      finishedDate: e.target.value || undefined,
                    })
                  }
                />
              ) : (
                <ReadOnly>{p.finishedDate ? formatShortDate(p.finishedDate) : '—'}</ReadOnly>
              ),
            )}
            {field('Duración del proyecto', <ReadOnly>{formatDuration(duration)}</ReadOnly>)}
          </div>

          {field(
            'Comentarios',
            managerEditable ? (
              <SpellCheckTextarea
                rows={5}
                value={p.comments}
                placeholder="Notas, cambios, bloqueos…"
                extraWords={[p.projectName, p.requestedBy]}
                onChange={(e) => updateProject(p.id, { comments: e.target.value })}
              />
            ) : (
              <ReadOnly>{p.comments || 'Sin comentarios'}</ReadOnly>
            ),
          )}
        </div>

        <section className="project-attachments-bar" aria-label="Archivos del proyecto">
          <h3 className="project-attachments-heading">
            Archivos e imágenes del proyecto
            {projectAttachments.length > 0 && (
              <span className="project-attachments-badge">{projectAttachments.length}</span>
            )}
          </h3>
          <p className="project-attachments-sub">
            El equipo verá estos archivos en el proyecto y al enviar una indicación.
          </p>
          {managerEditable ? (
            <FileAttachmentsEditor
              attachments={projectAttachments}
              onChange={handleProjectAttachmentsChange}
              onError={(msg) => toast.error(msg)}
              onSuccess={(msg) => toast.success(msg)}
            />
          ) : projectAttachments.length > 0 ? (
            <FileAttachmentsList attachments={projectAttachments} />
          ) : (
            <p className="project-readonly">Sin archivos adjuntos</p>
          )}
        </section>

        {canCompleteWork && (
          <section
            ref={completionSectionRef}
            className="project-completion-bar"
            aria-label="Entrega del trabajo"
          >
            <h3 className="project-attachments-heading">Entrega del trabajo</h3>
            <p className="project-attachments-sub">
              Sube una <strong>imagen del trabajo terminado</strong> (captura o foto). Sin prueba no
              se puede marcar como concluido.
            </p>
            <input
              ref={proofInputRef}
              type="file"
              accept="image/*"
              className="project-proof-input"
              disabled={proofBusy}
              onChange={handleProofFile}
            />
            {completionProof ? (
              <figure className="project-proof-preview">
                <img src={completionProof.dataUrl} alt="Prueba de trabajo terminado" />
                <figcaption>
                  <span>{completionProof.name}</span>
                  <button
                    type="button"
                    className="btn-ghost project-proof-remove"
                    disabled={proofBusy}
                    onClick={() => void handleRemoveProof()}
                  >
                    Cambiar imagen
                  </button>
                </figcaption>
              </figure>
            ) : (
              <button
                type="button"
                className="btn-ghost project-proof-upload-btn"
                disabled={proofBusy}
                onClick={() => proofInputRef.current?.click()}
              >
                {proofBusy ? 'Guardando imagen…' : '📷 Subir imagen del trabajo terminado'}
              </button>
            )}
            <button
              type="button"
              className="btn-primary project-complete-work-btn"
              disabled={!completionProof || completeBusy || proofBusy}
              onClick={() => void handleCompleteWork()}
            >
              {completeBusy ? 'Concluyendo…' : '✓ Trabajo concluido'}
            </button>
          </section>
        )}

        {isFinished && (completionProof || p.hasCompletionProof) && (
          <section className="project-completion-bar project-completion-bar--readonly">
            <h3 className="project-attachments-heading">Prueba de entrega</h3>
            {p.completedByName && (
              <p className="project-attachments-sub">
                Cerrado por {p.completedByName}
                {p.finishedDate ? ` · ${formatShortDate(p.finishedDate)}` : ''}
              </p>
            )}
            {completionProof ? (
              <figure className="project-proof-preview">
                <img src={completionProof.dataUrl} alt="Prueba de entrega" />
              </figure>
            ) : (
              <p className="project-readonly">Prueba registrada (recarga si no se ve la imagen)</p>
            )}
          </section>
        )}

        <footer className="modal-footer project-detail-footer">
          {managerEditable && (
            <div className="project-assign-send">
              <label className="project-assign-label">
                Enviar indicación a
                <select
                  value={assignToId}
                  onChange={(e) => setAssignToId(e.target.value)}
                >
                  <option value="">Selecciona colaborador…</option>
                  {assignable.map((t) => (
                    <option key={t.employeeId} value={t.employeeId}>
                      {t.employeeName}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn-ghost"
                disabled={!assignToId}
                onClick={() => {
                  if (!assignToId) {
                    toast.info('Elige a quién enviar la indicación (Jorddy, Roberto, etc.).');
                    return;
                  }
                  const recipient = assignable.find((t) => t.employeeId === assignToId);
                  createAssignment({
                    employeeId: assignToId,
                    title: p.projectName.trim() || 'Proyecto creativo',
                    objective: buildObjectiveFromProject(p),
                    dueDate: p.commitmentDate,
                    priority: assignmentPriorityFromProject(p.priority),
                    notes: '',
                    brief: briefFromProject(p),
                    attachments: cloneAttachments(projectAttachments),
                  });
                  const fileCount = projectAttachments.length;
                  const fileNote =
                    fileCount > 0
                      ? ` con ${fileCount} archivo${fileCount > 1 ? 's' : ''} adjunto${fileCount > 1 ? 's' : ''}`
                      : '';
                  toast.success(
                    recipient
                      ? `Indicación enviada a ${recipient.employeeName}${fileNote}`
                      : `Indicación enviada${fileNote}`,
                  );
                  onClose();
                }}
              >
                Enviar indicación
              </button>
            </div>
          )}
          {managerEditable && (
            <button
              type="button"
              className="btn-danger"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Eliminar proyecto',
                  message: `¿Eliminar «${p.projectName}» por completo?`,
                  confirmLabel: 'Eliminar',
                  danger: true,
                });
                if (ok) {
                  deleteProject(p.id);
                  onClose();
                }
              }}
            >
              Eliminar proyecto
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
