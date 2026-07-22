import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { FileAttachmentsEditor, FileAttachmentsList } from './FileAttachments';
import { SpellCheckTextarea } from './SpellCheckField';
import { isActiveProject } from '../utils/activeItems';
import { projectsAssignedToEmployee } from '../utils/employeeWorkStats';
import { MAX_PROGRESS_FILES } from '../utils/fileAttachments';
import type { CreativeProject, FileAttachment, ProjectProgressUpdate } from '../types';
import './AvancesView.css';

function formatProgressDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-MX', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

interface FeedItem {
  projectId: string;
  projectName: string;
  update: ProjectProgressUpdate;
}

interface TeamMemberRow {
  userId: string;
  name: string;
  avatarColor: string;
  count: number;
  items: FeedItem[];
}

export function AvancesView() {
  const {
    user,
    canEditAll,
    activeUsers,
    visibleProjects,
    allProjects,
    addProjectProgress,
    deleteProjectProgress,
  } = useApp();
  const toast = useToast();

  const myProjects = useMemo(() => {
    const source = canEditAll ? visibleProjects : allProjects;
    const list = canEditAll
      ? source.filter(isActiveProject)
      : user?.employeeId
        ? projectsAssignedToEmployee(source, user.employeeId, activeUsers).filter(
            isActiveProject,
          )
        : [];
    return [...list].sort((a, b) =>
      (a.projectName || '').localeCompare(b.projectName || '', 'es'),
    );
  }, [canEditAll, visibleProjects, allProjects, user?.employeeId, activeUsers]);

  const [selectedId, setSelectedId] = useState<string>('');
  const selected =
    myProjects.find((p) => p.id === selectedId) ?? myProjects[0] ?? null;

  const [text, setText] = useState('');
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const allFeedItems = useMemo(() => {
    const source = canEditAll ? visibleProjects : myProjects;
    const items: FeedItem[] = [];
    for (const p of source) {
      for (const up of p.progressUpdates ?? []) {
        if (!canEditAll && up.authorId !== user?.id) continue;
        items.push({
          projectId: p.id,
          projectName: p.projectName || 'Proyecto',
          update: up,
        });
      }
    }
    return items.sort(
      (a, b) =>
        new Date(b.update.createdAt).getTime() - new Date(a.update.createdAt).getTime(),
    );
  }, [canEditAll, visibleProjects, myProjects, user?.id]);

  const teamMembers = useMemo((): TeamMemberRow[] => {
    const byAuthor = new Map<string, FeedItem[]>();
    for (const item of allFeedItems) {
      const key = item.update.authorId || item.update.authorName || 'unknown';
      const list = byAuthor.get(key) ?? [];
      list.push(item);
      byAuthor.set(key, list);
    }

    const employees = activeUsers
      .filter((u) => u.role === 'empleado' && u.employeeId)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));

    const rows: TeamMemberRow[] = employees.map((u) => {
      const items = byAuthor.get(u.id) ?? [];
      return {
        userId: u.id,
        name: u.name,
        avatarColor: u.avatarColor || '#64748b',
        count: items.length,
        items,
      };
    });

    // Avances de autores que ya no están en el roster (o admin/líder)
    for (const [authorId, items] of byAuthor) {
      if (rows.some((r) => r.userId === authorId)) continue;
      const name = items[0]?.update.authorName || 'Sin nombre';
      rows.push({
        userId: authorId,
        name,
        avatarColor: '#94a3b8',
        count: items.length,
        items,
      });
    }

    return rows.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [activeUsers, allFeedItems]);

  const selectedMember =
    teamMembers.find((m) => m.userId === selectedMemberId) ?? null;

  const recentFeed = useMemo(() => allFeedItems.slice(0, 40), [allFeedItems]);

  const handleSubmit = () => {
    if (!selected) {
      toast.info('Elige un proyecto primero.');
      return;
    }
    if (!text.trim() && files.length === 0) {
      toast.info('Escribe el avance o sube al menos una evidencia.');
      return;
    }
    setBusy(true);
    try {
      const ok = addProjectProgress(selected.id, {
        text,
        files: files.length ? files.slice(0, MAX_PROGRESS_FILES) : undefined,
      });
      if (ok) {
        const n = files.length;
        setText('');
        setFiles([]);
        toast.success(
          n > 0
            ? `Avance registrado con ${n} evidencia${n === 1 ? '' : 's'}. Orlando ya fue notificado.`
            : 'Avance registrado. Orlando ya fue notificado.',
        );
      } else {
        toast.error('No se pudo registrar el avance.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (projectId: string, updateId: string) => {
    deleteProjectProgress(projectId, updateId);
    toast.info('Avance eliminado');
  };

  if (canEditAll) {
    return (
      <div className="avances-view">
        <header className="avances-hero">
          <div>
            <h1 className="avances-title">Avances y evidencias</h1>
            <p className="avances-sub">
              Elige a un colaborador para ver todos sus avances y observaciones completas:
              textos, videos, GIFs, PDFs e imágenes.
            </p>
          </div>
        </header>

        <div className="avances-manager-layout">
          <aside className="avances-people" aria-label="Colaboradores">
            <h2>Equipo</h2>
            {teamMembers.length === 0 ? (
              <p className="avances-empty">No hay colaboradores en el roster.</p>
            ) : (
              <ul className="avances-people-list">
                {teamMembers.map((member) => {
                  const active = selectedMemberId === member.userId;
                  return (
                    <li key={member.userId}>
                      <button
                        type="button"
                        className={`avances-person-btn${active ? ' is-active' : ''}`}
                        onClick={() => setSelectedMemberId(member.userId)}
                        aria-pressed={active}
                      >
                        <span
                          className="avances-person-avatar"
                          style={{ background: member.avatarColor }}
                          aria-hidden
                        >
                          {member.name.trim().charAt(0).toUpperCase() || '?'}
                        </span>
                        <span className="avances-person-meta">
                          <span className="avances-person-name">{member.name}</span>
                          <span className="avances-person-count">
                            {member.count === 0
                              ? 'Sin avances'
                              : `${member.count} avance${member.count === 1 ? '' : 's'}`}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          <section className="avances-member-feed" aria-label="Avances del colaborador">
            {!selectedMember ? (
              <div className="avances-pick-hint">
                <p>Selecciona a alguien del equipo para ver sus avances.</p>
              </div>
            ) : (
              <>
                <header className="avances-member-head">
                  <div>
                    <h2>{selectedMember.name}</h2>
                    <p>
                      {selectedMember.count === 0
                        ? 'Todavía no ha registrado avances.'
                        : `${selectedMember.count} avance${selectedMember.count === 1 ? '' : 's'} registrado${selectedMember.count === 1 ? '' : 's'}`}
                    </p>
                  </div>
                </header>

                {selectedMember.items.length === 0 ? (
                  <p className="avances-empty">Sin registros por ahora.</p>
                ) : (
                  <ul className="avances-feed-list avances-feed-list--full">
                    {selectedMember.items.map((item) => (
                      <FeedCard
                        key={`${item.projectId}-${item.update.id}`}
                        item={item}
                        canDelete
                        onDelete={() => handleDelete(item.projectId, item.update.id)}
                        showAuthor={false}
                      />
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="avances-view">
      <header className="avances-hero">
        <div>
          <h1 className="avances-title">Avances y evidencias</h1>
          <p className="avances-sub">
            Elige tu proyecto, cuenta qué hiciste y sube varias evidencias. Orlando recibe aviso al
            instante.
          </p>
        </div>
      </header>

      <div className="avances-layout">
        <section className="avances-compose" aria-label="Registrar avance">
          <h2>Registrar avance</h2>
          {myProjects.length === 0 ? (
            <p className="avances-empty">No tienes proyectos activos asignados.</p>
          ) : (
            <form
              className="avances-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
            >
              <label className="avances-field">
                Proyecto
                <select
                  value={selected?.id ?? ''}
                  onChange={(e) => setSelectedId(e.target.value)}
                  required
                >
                  {myProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.projectName || 'Sin nombre'}
                    </option>
                  ))}
                </select>
              </label>

              <label className="avances-field">
                ¿Qué avanzaste?
                <SpellCheckTextarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={4}
                  maxLength={1200}
                  placeholder="Describe el cambio o el trabajo que hiciste…"
                />
              </label>

              <div className="avances-files">
                <span className="avances-files-label">Evidencias</span>
                <p className="avances-files-hint">
                  Video, GIF, PDF, imágenes u otros — hasta {MAX_PROGRESS_FILES} archivos.
                </p>
                <FileAttachmentsEditor
                  attachments={files}
                  onChange={(next) => setFiles(next.slice(0, MAX_PROGRESS_FILES))}
                  disabled={busy}
                  onError={(msg) => toast.error(msg)}
                  onSuccess={(msg) => toast.success(msg)}
                  enableLibrary
                />
              </div>

              <button type="submit" className="btn-primary avances-submit" disabled={busy}>
                {busy ? 'Registrando…' : 'Subir avance y notificar'}
              </button>
            </form>
          )}

          {selected && (selected.progressUpdates?.length ?? 0) > 0 && (
            <div className="avances-project-history">
              <h3>Historial de este proyecto</h3>
              <ProgressList
                project={selected}
                canDelete={(up) => up.authorId === user?.id}
                onDelete={(id) => handleDelete(selected.id, id)}
              />
            </div>
          )}
        </section>

        <section className="avances-feed" aria-label="Actividad reciente">
          <h2>Tus últimos avances</h2>
          {recentFeed.length === 0 ? (
            <p className="avances-empty">Todavía no hay avances registrados.</p>
          ) : (
            <ul className="avances-feed-list avances-feed-list--full">
              {recentFeed.map((item) => (
                <FeedCard
                  key={`${item.projectId}-${item.update.id}`}
                  item={item}
                  canDelete={item.update.authorId === user?.id}
                  onDelete={() => handleDelete(item.projectId, item.update.id)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function FeedCard({
  item,
  canDelete,
  onDelete,
  showAuthor = true,
}: {
  item: FeedItem;
  canDelete: boolean;
  onDelete: () => void;
  showAuthor?: boolean;
}) {
  return (
    <li className="avances-feed-item">
      <div className="avances-feed-head">
        {showAuthor ? <strong>{item.update.authorName}</strong> : <strong>{item.projectName}</strong>}
        <span>{formatProgressDate(item.update.createdAt)}</span>
      </div>
      {showAuthor && <p className="avances-feed-project">{item.projectName}</p>}
      {item.update.text ? (
        <p className="avances-feed-text">{item.update.text}</p>
      ) : (
        <p className="avances-feed-text avances-feed-text--muted">Sin observación escrita.</p>
      )}
      {(item.update.files?.length ?? 0) > 0 && (
        <FileAttachmentsList attachments={item.update.files!} compact />
      )}
      {(item.update.images?.length ?? 0) > 0 && (
        <div className="avances-legacy-thumbs">
          {item.update.images!.map((img, i) => (
            <a
              key={`${item.update.id}-img-${i}`}
              href={img.dataUrl}
              download={img.name || `evidencia-${i + 1}.jpg`}
              title={img.name}
            >
              <img src={img.dataUrl} alt={img.name} />
            </a>
          ))}
        </div>
      )}
      {canDelete && (
        <button type="button" className="btn-ghost avances-feed-delete" onClick={onDelete}>
          Eliminar
        </button>
      )}
    </li>
  );
}

function ProgressList({
  project,
  canDelete,
  onDelete,
}: {
  project: CreativeProject;
  canDelete: (up: ProjectProgressUpdate) => boolean;
  onDelete: (id: string) => void;
}) {
  const updates = [...(project.progressUpdates ?? [])].reverse();
  return (
    <ul className="avances-feed-list avances-feed-list--compact">
      {updates.map((up) => (
        <li key={up.id} className="avances-feed-item">
          <div className="avances-feed-head">
            <strong>{up.authorName}</strong>
            <span>{formatProgressDate(up.createdAt)}</span>
          </div>
          {up.text && <p className="avances-feed-text">{up.text}</p>}
          {(up.files?.length ?? 0) > 0 && (
            <FileAttachmentsList attachments={up.files!} compact />
          )}
          {canDelete(up) && (
            <button
              type="button"
              className="btn-ghost avances-feed-delete"
              onClick={() => onDelete(up.id)}
            >
              Eliminar
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
