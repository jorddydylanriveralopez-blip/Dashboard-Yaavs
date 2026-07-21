import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { projectVisibleToUser } from '../utils/collaboratorMap';
import { labelForProjectCollaborators } from '../utils/projectCollaborators';
import {
  labelFor,
  PROJECT_STATUSES,
  PROJECT_STATUS_COLORS,
} from '../data/projectOptions';
import { formatShortDate } from '../utils/formatDate';
import { getProjectTimelineInfo, projectDueDate } from '../utils/projectTimeline';
import { LiveDeadlineChip } from './ProjectTimelineCountdown';
import { ProjectHoursBadge } from './ProjectHoursBadge';
import type { CreativeProject, ProjectStatus } from '../types';
import './ProjectsKanban.css';
import './ProjectTimelineCountdown.css';

const KANBAN_COLUMNS = PROJECT_STATUSES.map((s) => s.value).filter(
  (s) => s !== 'terminado',
);

interface Props {
  projects: CreativeProject[];
  onSelect: (project: CreativeProject) => void;
  statusFilter?: ProjectStatus | 'all';
}

export function ProjectsKanban({ projects, onSelect, statusFilter = 'all' }: Props) {
  const { user, canEditAll, activeUsers, updateProject } = useApp();
  const [dragId, setDragId] = useState<string | null>(null);

  const byStatus = useMemo(() => {
    const map = new Map<ProjectStatus, CreativeProject[]>();
    for (const col of KANBAN_COLUMNS) map.set(col, []);
    for (const p of projects) {
      const list = map.get(p.status);
      if (list) list.push(p);
    }
    return map;
  }, [projects]);

  const visibleColumns = useMemo(() => {
    if (statusFilter !== 'all') {
      return KANBAN_COLUMNS.filter((s) => s === statusFilter);
    }
    return KANBAN_COLUMNS.filter((s) => (byStatus.get(s)?.length ?? 0) > 0);
  }, [byStatus, statusFilter]);

  const canDrag = (p: CreativeProject) =>
    canEditAll || projectVisibleToUser(p, user, false, activeUsers);

  const handleDrop = (status: ProjectStatus) => {
    if (!dragId) return;
    const project = projects.find((p) => p.id === dragId);
    if (!project || !canDrag(project) || project.status === status) {
      setDragId(null);
      return;
    }
    updateProject(project.id, { status });
    setDragId(null);
  };

  if (visibleColumns.length === 0) {
    return null;
  }

  return (
    <div className="projects-kanban">
      <p className="projects-kanban-hint">
        Proyectos por columna de estatus.{' '}
        {canEditAll
          ? 'Arrastra una tarjeta para cambiar de columna.'
          : 'Toca una tarjeta para ver el detalle.'}
      </p>
      <div
        className={`kanban-board${visibleColumns.length <= 3 ? ' kanban-board--wide' : ''}`}
      >
        {visibleColumns.map((status) => {
          const colProjects = byStatus.get(status) ?? [];
          return (
            <div
              key={status}
              className="kanban-column"
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('kanban-column--over');
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('kanban-column--over');
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('kanban-column--over');
                handleDrop(status);
              }}
            >
              <header
                className="kanban-column-head"
                style={{ borderColor: PROJECT_STATUS_COLORS[status] }}
              >
                <span
                  className="kanban-column-dot"
                  style={{ background: PROJECT_STATUS_COLORS[status] }}
                />
                {labelFor(PROJECT_STATUSES, status)}
                <span className="kanban-column-count">{colProjects.length}</span>
              </header>
              <ul className="kanban-cards">
                {colProjects.map((p) => {
                  const timeline = getProjectTimelineInfo(p);
                  const due = projectDueDate(p);
                  return (
                  <li key={p.id}>
                    <article
                      className={`kanban-card ${dragId === p.id ? 'kanban-card--dragging' : ''}${timeline.tone === 'overdue' ? ' kanban-card--late' : ''}`}
                      draggable={canDrag(p)}
                      onDragStart={() => setDragId(p.id)}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => onSelect(p)}
                      style={
                        { '--card-accent': PROJECT_STATUS_COLORS[p.status] } as React.CSSProperties
                      }
                    >
                      <div className="kanban-card-top">
                        <h4>{p.projectName.trim() || 'Sin nombre'}</h4>
                        <span
                          className={`kanban-priority kanban-priority--${p.priority}`}
                        >
                          {p.priority === 'alta_urgente'
                            ? 'Urgente'
                            : p.priority === 'media'
                              ? 'Media'
                              : 'Baja'}
                        </span>
                      </div>
                      <p className="kanban-card-collab">
                        {labelForProjectCollaborators(p)}
                      </p>
                      <div className="kanban-card-meta">
                        <span
                          className={`kanban-card-deadline kanban-card-deadline--${timeline.tone}`}
                        >
                          {timeline.label}
                        </span>
                        <LiveDeadlineChip project={p} className="kanban-card-countdown" />
                        <div className="kanban-card-dates">
                          <span>
                            <em>Solicitud</em> {formatShortDate(p.requestDate)}
                          </span>
                          <span>
                            <em>Entrega</em>{' '}
                            {due ? formatShortDate(due) : 'Pendiente'}
                          </span>
                        </div>
                        {(p.attachmentCount ?? p.attachments?.length ?? 0) > 0 && (
                          <span className="kanban-card-files">
                            📎 {p.attachmentCount ?? p.attachments!.length}
                          </span>
                        )}
                      </div>
                      <div className="kanban-card-hours">
                        <ProjectHoursBadge project={p} compact showLabel={false} />
                      </div>
                    </article>
                  </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
