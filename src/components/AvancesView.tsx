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

interface CollaboratorGroup {
  authorId: string;
  authorName: string;
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
  const [collabFilter, setCollabFilter] = useState<string>('all');

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

  const collaboratorGroups = useMemo((): CollaboratorGroup[] => {
    const map = new Map<string, CollaboratorGroup>();
    for (const item of allFeedItems) {
      const key = item.update.authorId || item.update.authorName || 'unknown';
      const existing = map.get(key);
      if (existing) {
        existing.items.push(item);
      } else {
        map.set(key, {
          authorId: key,
          authorName: item.update.authorName || 'Sin nombre',
          items: [item],
        });
      }
    }
    return [...map.values()].sort((a, b) =>
      a.authorName.localeCompare(b.authorName, 'es'),
    );
  }, [allFeedItems]);

  const recentFeed = useMemo(() => {
    if (!canEditAll) return allFeedItems.slice(0, 40);
    if (collabFilter === 'all') return allFeedItems.slice(0, 60);
    return allFeedItems
      .filter((item) => item.update.authorId === collabFilter)
      .slice(0, 60);
  }, [canEditAll, allFeedItems, collabFilter]);

  const visibleGroups = useMemo(() => {
    if (!canEditAll) return [];
    if (collabFilter === 'all') return collaboratorGroups;
    return collaboratorGroups.filter((g) => g.authorId === collabFilter);
  }, [canEditAll, collaboratorGroups, collabFilter]);

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

  return (
    <div className="avances-view">
      <header className="avances-hero">
        <div>
          <h1 className="avances-title">Avances y evidencias</h1>
          <p className="avances-sub">
            {canEditAll
              ? 'Revisa los avances y evidencias de cada colaborador: textos, videos, GIFs, PDFs e imágenes.'
              : 'Elige tu proyecto, cuenta qué hiciste y sube varias evidencias. Orlando recibe aviso al instante.'}
          </p>
        </div>
      </header>

      <div className="avances-layout">
        <section className="avances-compose" aria-label="Registrar avance">
          <h2>Registrar avance</h2>
          {myProjects.length === 0 ? (
            <p className="avances-empty">
              {canEditAll
                ? 'No hay proyectos activos para registrar avances.'
                : 'No tienes proyectos activos asignados.'}
            </p>
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
                canDelete={(up) => canEditAll || up.authorId === user?.id}
                onDelete={(id) => handleDelete(selected.id, id)}
              />
            </div>
          )}
        </section>

        <section className="avances-feed" aria-label="Actividad reciente">
          {canEditAll ? (
            <>
              <h2>Por colaborador</h2>
              {collaboratorGroups.length === 0 ? (
                <p className="avances-empty">Todavía no hay avances registrados.</p>
              ) : (
                <>
                  <div className="avances-collab-tabs" role="tablist" aria-label="Filtrar por colaborador">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={collabFilter === 'all'}
                      className={`avances-collab-tab${collabFilter === 'all' ? ' is-active' : ''}`}
                      onClick={() => setCollabFilter('all')}
                    >
                      Todos ({allFeedItems.length})
                    </button>
                    {collaboratorGroups.map((g) => (
                      <button
                        key={g.authorId}
                        type="button"
                        role="tab"
                        aria-selected={collabFilter === g.authorId}
                        className={`avances-collab-tab${collabFilter === g.authorId ? ' is-active' : ''}`}
                        onClick={() => setCollabFilter(g.authorId)}
                      >
                        {g.authorName} ({g.items.length})
                      </button>
                    ))}
                  </div>

                  <div className="avances-collab-groups">
                    {visibleGroups.map((group) => (
                      <div key={group.authorId} className="avances-collab-group">
                        <h3 className="avances-collab-name">
                          {group.authorName}
                          <span>{group.items.length} avance{group.items.length === 1 ? '' : 's'}</span>
                        </h3>
                        <ul className="avances-feed-list">
                          {(collabFilter === 'all' ? group.items.slice(0, 12) : group.items.slice(0, 40)).map(
                            (item) => (
                              <FeedCard
                                key={`${item.projectId}-${item.update.id}`}
                                item={item}
                                canDelete={canEditAll || item.update.authorId === user?.id}
                                onDelete={() => handleDelete(item.projectId, item.update.id)}
                              />
                            ),
                          )}
                        </ul>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <h2>Tus últimos avances</h2>
              {recentFeed.length === 0 ? (
                <p className="avances-empty">Todavía no hay avances registrados.</p>
              ) : (
                <ul className="avances-feed-list">
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
            </>
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
}: {
  item: FeedItem;
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <li className="avances-feed-item">
      <div className="avances-feed-head">
        <strong>{item.update.authorName}</strong>
        <span>{formatProgressDate(item.update.createdAt)}</span>
      </div>
      <p className="avances-feed-project">{item.projectName}</p>
      {item.update.text && <p className="avances-feed-text">{item.update.text}</p>}
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
