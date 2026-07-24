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
  INTERNAL_AREAS,
  labelFor,
  labelForInternalArea,
  normalizeInternalArea,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  PROJECT_STATUS_COLORS,
  PROJECT_TYPES,
  REQUESTED_BY_OPTIONS,
  REQUESTING_DEPARTMENTS,
  labelForRequestedBy,
  normalizeRequestedBy,
} from '../data/projectOptions';
import { goToCompletedProjects } from '../utils/projectsTab';
import { formatShortDate } from '../utils/formatDate';
import { calcProjectDurationDays, formatDuration } from '../utils/projectDuration';
import { projectDueDate } from '../utils/projectTimeline';
import {
  estimatedHoursForProject,
  formatHoursMinutes,
  getHoursPaceInfo,
  hoursPaceBarColor,
  hoursProgressPercent,
} from '../utils/projectHours';
import { EmployeeMultiSelect } from './EmployeeMultiSelect';
import { ProjectTimelineCountdown } from './ProjectTimelineCountdown';
import {
  getProjectCollaborators,
  patchForCollaboratorsChange,
} from '../utils/projectCollaborators';
import {
  canEmployeeCompleteProject,
  collaboratorForEmployeeId,
  projectNeedsAcceptance,
  projectVisibleToUser,
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
  ATTACHMENT_ACCEPT,
  MAX_PROGRESS_FILES,
  cloneAttachments,
  readFileAsAttachment,
} from '../utils/fileAttachments';
import { useWorkloadGuard } from '../hooks/useWorkloadGuard';
import { WorkloadOverrideModal } from './WorkloadOverrideModal';
import { notifyPush } from '../api/pushClient';
import type { CreativeProject, FileAttachment } from '../types';
import './ProjectDetailModal.css';

interface Props {
  projectId: string;
  onClose: () => void;
  /** Al abrir desde Inicio → Trabajo concluido, enfoca la sección de entrega. */
  focusCompletion?: boolean;
  /**
   * Borrador recién creado (aún no está en el tablero).
   * Solo se publica al enviar la indicación.
   */
  initialDraft?: CreativeProject;
}

function ReadOnly({ children }: { children: ReactNode }) {
  return <p className="project-readonly">{children}</p>;
}

function formatProgressDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ProjectDetailModal({
  projectId,
  onClose,
  focusCompletion,
  initialDraft,
}: Props) {
  const {
    user,
    canEditAll,
    board,
    updateProject,
    commitProject,
    syncAssignmentsFromProject,
    deleteProject,
    activeUsers,
    acceptProject,
    declineProject,
    addProjectProgress,
    deleteProjectProgress,
  } = useApp();
  const { confirm } = useConfirm();
  const toast = useToast();
  const { override, cancelOverride, confirmOverride, submitAssignment, assignProjectCollaborators } =
    useWorkloadGuard();
  const [assignToIds, setAssignToIds] = useState<string[]>([]);
  const [projectAttachments, setProjectAttachments] = useState<FileAttachment[]>([]);
  const [completionProof, setCompletionProof] = useState<FileAttachment | null>(null);
  const [proofBusy, setProofBusy] = useState(false);
  const [completeBusy, setCompleteBusy] = useState(false);
  const attachmentsTouchedRef = useRef(false);
  const proofInputRef = useRef<HTMLInputElement>(null);
  const completionSectionRef = useRef<HTMLElement>(null);
  const [progressText, setProgressText] = useState('');
  const [progressLinksNote, setProgressLinksNote] = useState('');
  const [progressFiles, setProgressFiles] = useState<FileAttachment[]>([]);
  const [progressBusy, setProgressBusy] = useState(false);
  const [declineBusy, setDeclineBusy] = useState(false);

  const boardProject = useMemo(
    () => (board.projects ?? []).find((x) => x.id === projectId),
    [board.projects, projectId],
  );

  const [draft, setDraft] = useState<CreativeProject | null>(() => {
    if (initialDraft && initialDraft.id === projectId) return initialDraft;
    return null;
  });

  const isDraft = !boardProject && Boolean(draft);
  const p = boardProject ?? draft;

  const canView = useMemo(
    () => (p ? projectVisibleToUser(p, user, canEditAll, activeUsers) : false),
    [p, user, canEditAll, activeUsers],
  );

  useEffect(() => {
    if (!p || canView || isDraft) return;
    const t = window.setTimeout(() => onClose(), 800);
    return () => window.clearTimeout(t);
  }, [p, canView, isDraft, onClose]);

  const applyPatch = (patch: Partial<CreativeProject>) => {
    if (isDraft) {
      setDraft((prev) =>
        prev
          ? { ...prev, ...patch, updatedAt: new Date().toISOString() }
          : prev,
      );
      return;
    }
    updateProject(projectId, patch);
  };

  const assignable = useMemo(
    () => assignableMarketingTasks(board.tasks, activeUsers),
    [board.tasks, activeUsers],
  );

  // No auto-cerrar si el proyecto "desaparece" un instante por sync.

  // Destinatarios: en borrador empiezan vacíos; en proyecto guardado, según colaboradores.
  useEffect(() => {
    if (isDraft) {
      setAssignToIds([]);
      return;
    }
    if (!p) return;
    const collabs = getProjectCollaborators(p);
    if (collabs.includes('todos')) {
      setAssignToIds(assignable.map((t) => t.employeeId));
      return;
    }
    const ids = collabs
      .map((slug) => employeeIdForCollaborator(slug, activeUsers))
      .filter((id): id is string => Boolean(id));
    setAssignToIds(ids);
    // Solo al abrir / cambiar de proyecto (no en cada tecleo del borrador).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- p deliberadamente omitido en borrador
  }, [projectId, isDraft, assignable, activeUsers]);

  useEffect(() => {
    if (isDraft) return;
    attachmentsTouchedRef.current = false;
    let cancelled = false;
    void loadProjectAttachments(projectId).then((files) => {
      if (!cancelled && !attachmentsTouchedRef.current) setProjectAttachments(files);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, isDraft]);

  useEffect(() => {
    if (isDraft) return;
    let cancelled = false;
    void loadProjectCompletionProof(projectId).then((proof) => {
      if (!cancelled) setCompletionProof(proof);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, isDraft]);

  const handleProjectAttachmentsChange = (attachments: FileAttachment[]) => {
    attachmentsTouchedRef.current = true;
    setProjectAttachments(attachments);
    if (isDraft) return;
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

  const canCompleteWorkFlag = p
    ? canEmployeeCompleteProject(p, user, canEditAll, activeUsers)
    : false;

  useEffect(() => {
    if (!focusCompletion || !p || !canCompleteWorkFlag) return;
    const t = window.setTimeout(() => {
      completionSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
    return () => window.clearTimeout(t);
  }, [focusCompletion, canCompleteWorkFlag, projectId, p]);

  if (!p) {
    return (
      <div className="modal-backdrop" onClick={onClose} role="presentation">
        <div
          className="modal-panel project-detail-modal"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal
          aria-label="Proyecto"
        >
          <header className="modal-header">
            <h2>Cargando proyecto…</h2>
            <button type="button" className="btn-icon" onClick={onClose} aria-label="Cerrar">
              ×
            </button>
          </header>
          <p className="project-readonly" style={{ padding: '16px 24px' }}>
            Si tarda mucho, cierra y vuelve a abrirlo. Puede ser un desfase de sincronización.
          </p>
        </div>
      </div>
    );
  }

  const managerEditable = canEditAll;
  const canCompleteWork = canCompleteWorkFlag;
  const isFinished = p.status === 'terminado';

  const handleProofFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setProofBusy(true);
    try {
      const att = await readFileAsAttachment(file);
      await saveProjectCompletionProof(projectId, att);
      setCompletionProof(att);
      updateProject(projectId, { hasCompletionProof: true });
      toast.success('Evidencia de entrega guardada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar el archivo');
    } finally {
      setProofBusy(false);
    }
  };

  const handleRemoveProof = async () => {
    const ok = await confirm({
      title: 'Quitar prueba',
      message: '¿Quitar la evidencia de entrega? No podrás marcar el trabajo concluido sin ella.',
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
      toast.error('Sube primero una evidencia del trabajo terminado.');
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
      toast.success('Trabajo marcado como concluido — ya está en Concluidos');
      goToCompletedProjects();
      onClose();
    } finally {
      setCompleteBusy(false);
    }
  };
  const handleSubmitProgress = () => {
    if (!progressText.trim() && !progressLinksNote.trim() && progressFiles.length === 0) {
      toast.info('Escribe qué hiciste, pega un link o sube una evidencia.');
      return;
    }
    if (progressFiles.length > MAX_PROGRESS_FILES) {
      toast.error(`Máximo ${MAX_PROGRESS_FILES} archivos por avance.`);
      return;
    }
    setProgressBusy(true);
    try {
      const ok = addProjectProgress(projectId, {
        text: progressText,
        linksNote: !canEditAll ? progressLinksNote.trim() || undefined : undefined,
        files: progressFiles.length ? progressFiles : undefined,
      });
      if (ok) {
        setProgressText('');
        setProgressLinksNote('');
        setProgressFiles([]);
        toast.success('Avance registrado. Orlando recibirá la notificación.');
      } else {
        toast.error('No se pudo registrar el avance.');
      }
    } finally {
      setProgressBusy(false);
    }
  };

  const handleDeleteProgress = async (updateId: string) => {
    const ok = await confirm({
      title: 'Eliminar avance',
      message: '¿Eliminar este avance y su evidencia?',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (ok) deleteProjectProgress(projectId, updateId);
  };

  const collaboratorsFromAssignIds = () => {
    const slugs = assignToIds
      .map((id) => collaboratorForEmployeeId(id))
      .filter((slug): slug is NonNullable<typeof slug> => Boolean(slug));
    if (!slugs.length) {
      return { collaborator: 'todos' as const, collaborators: ['todos' as const] };
    }
    if (slugs.length === assignable.length && assignable.length > 0) {
      return patchForCollaboratorsChange(['todos']);
    }
    return patchForCollaboratorsChange(slugs);
  };

  const persistDraftProject = () => {
    if (!draft) return null;
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const projectForSave: CreativeProject = {
      ...draft,
      ...collaboratorsFromAssignIds(),
      updatedAt: now,
      finishedDate: draft.finishedDate || today,
      completedAt: draft.completedAt || (draft.status === 'terminado' ? now : undefined),
      completedByName:
        draft.completedByName ||
        (draft.status === 'terminado' ? user?.name ?? user?.username : undefined),
    };
    commitProject(projectForSave);
    if (projectAttachments.length > 0) {
      void persistProjectAttachments(projectForSave.id, projectAttachments, (id, patch) =>
        updateProject(id, patch),
      );
    }
    return projectForSave;
  };

  /** Borrador ya marcado como Concluido: publicar en Concluidos sin forzar indicación. */
  const handleSaveCompletedDraft = () => {
    if (!p || !isDraft) return;
    if (!p.projectName.trim()) {
      toast.info('Pon un nombre al proyecto antes de guardarlo.');
      return;
    }
    const saved = persistDraftProject();
    if (!saved) return;
    toast.success(`«${saved.projectName.trim()}» guardado en Concluidos`);
    goToCompletedProjects();
    onClose();
  };

  const handleSendAssignment = () => {
    if (!p) return;
    if (isDraft && p.status === 'terminado') {
      handleSaveCompletedDraft();
      return;
    }
    if (assignToIds.length === 0) {
      toast.info('Elige a quién enviar la indicación.');
      return;
    }
    if (!p.projectName.trim()) {
      toast.info('Pon un nombre al proyecto antes de enviarlo.');
      return;
    }

    let projectForSend = p;
    if (isDraft && draft) {
      const saved = persistDraftProject();
      if (!saved) return;
      projectForSend = saved;
    }

    const recipients = assignable.filter((t) => assignToIds.includes(t.employeeId));
    submitAssignment(
      {
        employeeIds: assignToIds,
        title: projectForSend.projectName.trim() || 'Proyecto creativo',
        objective: buildObjectiveFromProject(projectForSend),
        dueDate: projectForSend.finishedDate || projectForSend.requestDate,
        priority: assignmentPriorityFromProject(projectForSend.priority),
        notes: '',
        brief: briefFromProject(projectForSend),
        attachments: cloneAttachments(projectAttachments),
      },
      () => {
        const fileCount = projectAttachments.length;
        const fileNote =
          fileCount > 0 ? ` con ${fileCount} archivo${fileCount > 1 ? 's' : ''}` : '';
        const names = recipients.map((r) => r.employeeName).join(', ');
        toast.success(
          recipients.length
            ? `Proyecto creado e indicación enviada a ${names}${fileNote}`
            : `Proyecto creado e indicación enviada${fileNote}`,
        );
        onClose();
      },
    );
  };

  /** Proyectos ya publicados: guardar cambios sin crear otra indicación. */
  const handleUpdateProject = () => {
    if (!p || isDraft) return;
    if (!p.projectName.trim()) {
      toast.info('Pon un nombre al proyecto.');
      return;
    }

    const name = p.projectName.trim();
    const collabPatch = collaboratorsFromAssignIds();
    const slugs = (collabPatch.collaborators ?? []).filter((c) => c !== 'todos');

    const finishUpdate = () => {
      syncAssignmentsFromProject({ ...p, ...collabPatch });

      const notifyIds =
        assignToIds.length > 0
          ? assignToIds
          : assignable.map((t) => t.employeeId).filter(Boolean);

      if (notifyIds.length > 0) {
        notifyPush({
          audience: 'employees',
          employeeIds: notifyIds,
          excludeUserId: user?.id,
          title: 'Proyecto actualizado',
          body: `Orlando actualizó «${name}» (fechas o detalles). Revisa el proyecto.`,
          url: '/proyectos',
          tag: `proj-update-${p.id}`,
        });
      }

      toast.success(`Proyecto «${name}» actualizado. Sin indicación nueva.`);
      onClose();
    };

    if (collabPatch.collaborators?.includes('todos')) {
      assignProjectCollaborators(p.id, ['todos'], finishUpdate);
      return;
    }
    if (slugs.length > 0) {
      assignProjectCollaborators(p.id, slugs, finishUpdate);
      return;
    }
    finishUpdate();
  };

  const duration = calcProjectDurationDays(p.requestDate, p.finishedDate, p.status);
  const estHours = estimatedHoursForProject(p);
  const trackedMin = p.trackedMinutes ?? 0;
  const hoursPct = hoursProgressPercent(p);
  const pace = getHoursPaceInfo(p);

  const field = (label: string, content: ReactNode, fullWidth = false) => (
    <section className={`project-field${fullWidth ? ' project-field--full' : ''}`}>
      <label>{label}</label>
      {content}
    </section>
  );

  const displayName = p.projectName.trim() || 'Sin nombre';
  const needsAcceptance = projectNeedsAcceptance(p, user, canEditAll, activeUsers);

  const handleAcceptProject = () => {
    acceptProject(p.id);
    toast.success('Proyecto aceptado. El gerente ya fue notificado.');
  };

  const handleDeclineProject = async () => {
    if (declineBusy) return;
    const ok = await confirm({
      title: 'Rechazar proyecto',
      message: `¿Rechazar «${displayName}»? El gerente será notificado.`,
      confirmLabel: 'Rechazar',
      danger: true,
    });
    if (!ok) return;
    setDeclineBusy(true);
    try {
      declineProject(p.id);
      toast.info('Proyecto rechazado. El gerente ya fue notificado.');
      onClose();
    } finally {
      setDeclineBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-panel project-detail-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <header className="modal-header">
          <div>
            <h2>{isDraft ? (p.projectName.trim() || 'Nuevo proyecto') : displayName}</h2>
            {isDraft ? (
              <span className="status-pill-project" style={{ opacity: 0.85 }}>
                Borrador — aún no está en Proyectos
              </span>
            ) : (
              <span
                className={`status-pill-project status-pill-project--${p.status}`}
                style={
                  { '--status-color': PROJECT_STATUS_COLORS[p.status] } as CSSProperties
                }
              >
                {labelFor(PROJECT_STATUSES, p.status)}
              </span>
            )}
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className="project-detail-scroll">
        <ProjectTimelineCountdown project={p} className="project-detail-timeline" />

        {needsAcceptance && (
          <section className="project-accept-bar" aria-label="Aceptar proyecto">
            <h3 className="project-attachments-heading">¿Aceptas este proyecto?</h3>
            <p className="project-attachments-sub">
              Revísalo y confirma. Orlando recibirá un aviso en cuanto respondas.
            </p>
            <div className="project-accept-actions">
              <button
                type="button"
                className="btn-ghost"
                disabled={declineBusy}
                onClick={() => void handleDeclineProject()}
              >
                Rechazar
              </button>
              <button type="button" className="btn-primary" onClick={handleAcceptProject}>
                ✓ Aceptar proyecto
              </button>
            </div>
          </section>
        )}

        {managerEditable && p.acceptanceStatus && p.acceptanceStatus !== 'pending' && (
          <p
            className={`project-accept-status project-accept-status--${p.acceptanceStatus}`}
            style={{ padding: '8px 24px', margin: 0 }}
          >
            {p.acceptanceStatus === 'accepted'
              ? `✓ Aceptado por ${p.acceptedByName ?? 'colaborador'}${p.acceptedAt ? ` · ${formatProgressDate(p.acceptedAt)}` : ''}`
              : `✕ Rechazado por ${p.acceptedByName ?? 'colaborador'}${p.declinedReason ? `: ${p.declinedReason}` : ''}`}
          </p>
        )}

        {managerEditable && p.acceptanceStatus === 'pending' && (
          <p className="project-accept-status project-accept-status--pending" style={{ padding: '8px 24px', margin: 0 }}>
            ⏳ Esperando que el colaborador acepte este proyecto
          </p>
        )}

        {!managerEditable && (
        <div className="project-live-summary project-live-summary--compact" aria-live="polite">
          <div className="project-live-item">
            <span className="project-live-label">Solicitud</span>
            <strong>{formatShortDate(p.requestDate)}</strong>
          </div>
          <div className="project-live-item">
            <span className="project-live-label">Entrega</span>
            <strong>{projectDueDate(p) ? formatShortDate(projectDueDate(p)!) : 'Pendiente'}</strong>
          </div>
          <div className="project-live-item">
            <span className="project-live-label">Duración</span>
            <strong className="duration-big">{formatDuration(duration)}</strong>
          </div>
          <div className={`project-live-item project-live-item--pace project-live-item--${pace.level}`}>
            <span className="project-live-label">Horas</span>
            <strong>
              {formatHoursMinutes(trackedMin)} / {estHours} h
            </strong>
            <div className="project-hours-bar">
              <div
                className="project-hours-fill"
                style={{
                  width: `${Math.min(100, hoursPct)}%`,
                  background: hoursPaceBarColor(pace.level),
                }}
              />
            </div>
            <span className={`project-pace-pill project-pace-pill--${pace.level}`}>{pace.label}</span>
          </div>
        </div>
        )}

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
                  onChange={(e) => applyPatch( { projectName: e.target.value })}
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
                  onChange={(e) => applyPatch( { requestDate: e.target.value })}
                />
              ) : (
                <ReadOnly>{formatShortDate(p.requestDate)}</ReadOnly>
              ),
            )}
            {field(
              'Fecha de entrega',
              managerEditable ? (
                <input
                  type="date"
                  value={p.finishedDate ?? projectDueDate(p) ?? ''}
                  min={p.requestDate}
                  onChange={(e) => {
                    const due = e.target.value || undefined;
                    applyPatch( {
                      finishedDate: due,
                      commitmentDate: due ?? p.commitmentDate,
                    });
                  }}
                />
              ) : (
                <ReadOnly>
                  {projectDueDate(p) ? formatShortDate(projectDueDate(p)!) : '—'}
                </ReadOnly>
              ),
            )}
            {field(
              'Unidad de negocio',
              managerEditable ? (
                <select
                  value={p.businessUnit}
                  onChange={(e) =>
                    applyPatch( {
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
                <select
                  value={normalizeRequestedBy(p.requestedBy)}
                  onChange={(e) => applyPatch( { requestedBy: e.target.value })}
                >
                  <option value="">Seleccionar…</option>
                  {REQUESTED_BY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <ReadOnly>{labelForRequestedBy(p.requestedBy)}</ReadOnly>
              ),
            )}
            {field(
              'Área solicitante',
              managerEditable ? (
                <select
                  value={p.requestingDepartment}
                  onChange={(e) =>
                    applyPatch( {
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
                    applyPatch( {
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
                        applyPatch( {
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
            {field(
              'Área interna',
              managerEditable ? (
                <select
                  value={normalizeInternalArea(p.internalArea)}
                  onChange={(e) =>
                    applyPatch( {
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
                <ReadOnly>{labelForInternalArea(p.internalArea)}</ReadOnly>
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
                      applyPatch({
                        status,
                        finishedDate:
                          p.finishedDate ?? new Date().toISOString().slice(0, 10),
                        completedAt: new Date().toISOString(),
                        completedByName: user?.name ?? user?.username,
                      });
                      if (!isDraft) {
                        toast.success('Proyecto en Concluidos — ya se sincroniza con el equipo.');
                        goToCompletedProjects();
                      }
                      return;
                    }
                    applyPatch({ status });
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
            {field('Duración del proyecto', <ReadOnly>{formatDuration(duration)}</ReadOnly>)}
          </div>

          {field(
            'Comentarios',
            managerEditable ? (
              <SpellCheckTextarea
                rows={3}
                value={p.comments}
                placeholder="Notas, cambios, bloqueos…"
                autoFix={false}
                extraWords={[p.projectName, p.requestedBy]}
                onChange={(e) => applyPatch( { comments: e.target.value })}
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
          {managerEditable ? (
            <>
              <FileAttachmentsEditor
                attachments={projectAttachments}
                onChange={handleProjectAttachmentsChange}
                onError={(msg) => toast.error(msg)}
                onSuccess={(msg) => toast.success(msg)}
                enableLibrary
              />
            </>
          ) : projectAttachments.length > 0 ? (
            <FileAttachmentsList attachments={projectAttachments} />
          ) : (
            <p className="project-readonly">Sin archivos adjuntos</p>
          )}
        </section>

        {!isDraft && (
        <section className="project-progress-section" aria-label="Avances y evidencia">
          <h3 className="project-attachments-heading">Avances y evidencia</h3>
          <p className="project-attachments-sub">
            {canEditAll
              ? 'Bitácora del equipo: qué han hecho y sus evidencias.'
              : 'Cuenta qué hiciste y sube tu evidencia. Orlando lo verá al momento.'}
          </p>

          {!isFinished && (
            <div className="project-progress-form">
              <SpellCheckTextarea
                value={progressText}
                onChange={(e) => setProgressText(e.target.value)}
                placeholder="¿Qué avanzaste hoy? Ej. Terminé la propuesta de diseño y quedó lista para revisión…"
                rows={3}
                maxLength={1200}
              />
              {!canEditAll && (
                <label className="project-progress-links-field">
                  <span>
                    Links de páginas web{' '}
                    <span className="project-progress-optional">(opcional)</span>
                  </span>
                  <SpellCheckTextarea
                    value={progressLinksNote}
                    onChange={(e) => setProgressLinksNote(e.target.value)}
                    placeholder="Pega aquí links de páginas web, Figma, Drive…"
                    rows={2}
                    maxLength={2000}
                  />
                </label>
              )}
              <FileAttachmentsEditor
                attachments={progressFiles}
                onChange={(next) => setProgressFiles(next.slice(0, MAX_PROGRESS_FILES))}
                disabled={progressBusy}
                onError={(msg) => toast.error(msg)}
                onSuccess={(msg) => toast.success(msg)}
                enableLibrary
              />
              <p className="project-attachments-sub">
                Puedes subir varios archivos: video, GIF, PDF, imágenes u otros (máx.{' '}
                {MAX_PROGRESS_FILES}).
              </p>
              <div className="project-progress-actions">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={progressBusy}
                  onClick={handleSubmitProgress}
                >
                  {progressBusy ? 'Registrando…' : 'Registrar avance'}
                </button>
              </div>
            </div>
          )}

          {(p.progressUpdates?.length ?? 0) > 0 ? (
            <ul className="project-progress-list">
              {[...(p.progressUpdates ?? [])].reverse().map((up) => (
                <li key={up.id} className="project-progress-item">
                  <div className="project-progress-item-head">
                    <strong>{up.authorName}</strong>
                    <span>{formatProgressDate(up.createdAt)}</span>
                    {(canEditAll || up.authorId === user?.id) && (
                      <button
                        type="button"
                        className="project-progress-delete"
                        aria-label="Eliminar avance"
                        onClick={() => void handleDeleteProgress(up.id)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {up.text && <p className="project-progress-text">{up.text}</p>}
                  {up.linksNote?.trim() && (
                    <div className="project-progress-links">
                      <span className="project-progress-links-label">Links de páginas</span>
                      <p className="project-progress-text project-progress-links-body">
                        {up.linksNote.split(/(https?:\/\/[^\s<>"']+)/gi).map((part, i) =>
                          /^https?:\/\//i.test(part) ? (
                            <a
                              key={`pl-${up.id}-${i}`}
                              href={part}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {part}
                            </a>
                          ) : (
                            <span key={`pt-${up.id}-${i}`}>{part}</span>
                          ),
                        )}
                      </p>
                    </div>
                  )}
                  {(up.images?.length ?? 0) > 0 && (
                    <div className="project-progress-thumbs">
                      {up.images!.map((img, i) => (
                        <a
                          key={`${up.id}-img-${i}`}
                          href={img.dataUrl}
                          download={img.name || `evidencia-${i + 1}.jpg`}
                          className="project-progress-thumb project-progress-thumb--view"
                          title={`${img.name} · clic para descargar`}
                        >
                          <img src={img.dataUrl} alt={img.name} />
                        </a>
                      ))}
                    </div>
                  )}
                  {(up.files?.length ?? 0) > 0 && (
                    <FileAttachmentsList attachments={up.files!} compact />
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="project-readonly">Aún no hay avances registrados.</p>
          )}
        </section>
        )}

        {canCompleteWork && (
          <section
            ref={completionSectionRef}
            className="project-completion-bar"
            aria-label="Entrega del trabajo"
          >
            <h3 className="project-attachments-heading">Entrega del trabajo</h3>
            <p className="project-attachments-sub">
              Sube una <strong>evidencia del trabajo terminado</strong>: imagen, video, PDF,
              documento o cualquier otro archivo. Sin evidencia no se puede marcar como concluido.
            </p>
            <input
              ref={proofInputRef}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              className="project-proof-input"
              disabled={proofBusy}
              onChange={handleProofFile}
            />
            {completionProof ? (
              <div className="project-proof-preview">
                <FileAttachmentsList attachments={[completionProof]} compact />
                <button
                  type="button"
                  className="btn-ghost project-proof-remove"
                  disabled={proofBusy}
                  onClick={() => void handleRemoveProof()}
                >
                  Cambiar evidencia
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn-ghost project-proof-upload-btn"
                disabled={proofBusy}
                onClick={() => proofInputRef.current?.click()}
              >
                {proofBusy ? 'Guardando archivo…' : '📎 Subir evidencia del trabajo terminado'}
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
              <div className="project-proof-preview">
                <FileAttachmentsList attachments={[completionProof]} compact />
              </div>
            ) : (
              <p className="project-readonly">
                Evidencia registrada (recarga si no aparece el archivo)
              </p>
            )}
          </section>
        )}

        {managerEditable && (
          <section
            className="project-assign-bar"
            aria-label={isDraft ? 'Enviar indicación' : 'Colaboradores'}
          >
            <h3 className="project-attachments-heading">
              {isDraft ? 'Enviar indicación a' : 'Quién ve / recibe el proyecto'}
            </h3>
            <p className="project-attachments-sub">
              {isDraft
                ? 'Elige a quién enviar la indicación (uno, varios, Todos o Ninguno si solo guardas como concluido).'
                : 'Los cambios de fechas o detalles se guardan en el proyecto. No se crea otra indicación.'}
            </p>
            <EmployeeMultiSelect
              assignable={assignable}
              values={assignToIds}
              onChange={setAssignToIds}
            />
          </section>
        )}
        </div>

        <footer className="modal-footer project-detail-footer">
          {managerEditable ? (
            <>
              {isDraft ? (
                <button
                  type="button"
                  className="btn-ghost project-detail-footer-delete"
                  onClick={onClose}
                >
                  Descartar
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-danger project-detail-footer-delete"
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
              <button
                type="button"
                className="btn-primary project-detail-footer-send"
                disabled={
                  isDraft &&
                  p.status !== 'terminado' &&
                  assignToIds.length === 0
                }
                onClick={
                  isDraft
                    ? p.status === 'terminado'
                      ? handleSaveCompletedDraft
                      : handleSendAssignment
                    : handleUpdateProject
                }
              >
                {isDraft
                  ? p.status === 'terminado'
                    ? 'Guardar en Concluidos'
                    : 'Crear y enviar'
                  : 'Actualizar proyecto'}
              </button>
            </>
          ) : (
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cerrar
            </button>
          )}
        </footer>
      </div>
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
