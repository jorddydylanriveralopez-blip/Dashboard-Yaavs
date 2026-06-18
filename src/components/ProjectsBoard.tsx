import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { collaboratorForUser } from '../utils/collaboratorMap';
import { groupProjectsForBoard } from '../utils/projectGroups';
import {
  BUSINESS_UNITS,
  COLLABORATORS,
  INTERNAL_AREAS,
  labelFor,
  PROJECT_STATUSES,
  PROJECT_STATUS_COLORS,
  PROJECT_TYPES,
  REQUESTING_DEPARTMENTS,
} from '../data/projectOptions';
import { formatShortDate } from '../utils/formatDate';
import { fuzzyIncludes } from '../utils/fuzzyMatch';
import { isActiveProject } from '../utils/activeItems';
import { calcProjectDurationDays, formatDuration } from '../utils/projectDuration';
import type { CreativeProject, ProjectStatus } from '../types';
import './ProjectsBoard.css';

const STATUS_ORDER = PROJECT_STATUSES.map((s) => s.value).filter(
  (s) => s !== 'terminado',
);

interface Props {
  projects: CreativeProject[];
  filter: string;
  onSelect: (project: CreativeProject) => void;
  onGoCompleted?: () => void;
}

export function ProjectsBoard({ projects, filter, onSelect, onGoCompleted }: Props) {
  const { user, canEditAll, addProject } = useApp();
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const myCollaborator = collaboratorForUser(user);

  const activeProjects = useMemo(
    () => projects.filter(isActiveProject),
    [projects],
  );

  const filtered = useMemo(() => {
    const q = filter.trim();
    let list = activeProjects;
    if (statusFilter !== 'all') {
      list = list.filter((p) => p.status === statusFilter);
    }
    if (!q) return list;
    return list.filter(
      (p) =>
        fuzzyIncludes(p.projectName, q) ||
        fuzzyIncludes(p.requestedBy, q) ||
        fuzzyIncludes(labelFor(COLLABORATORS, p.collaborator), q) ||
        fuzzyIncludes(labelFor(BUSINESS_UNITS, p.businessUnit), q),
    );
  }, [activeProjects, filter, statusFilter]);

  const projectGroups = useMemo(
    () => groupProjectsForBoard(filtered, canEditAll, myCollaborator),
    [filtered, canEditAll, myCollaborator],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: activeProjects.length };
    for (const s of STATUS_ORDER) {
      c[s] = activeProjects.filter((p) => p.status === s).length;
    }
    return c;
  }, [activeProjects]);

  const visibleFilters = useMemo(() => {
    const chips: { id: ProjectStatus | 'all'; count: number }[] = [
      { id: 'all', count: counts.all },
    ];
    for (const s of STATUS_ORDER) {
      if ((counts[s] ?? 0) > 0) chips.push({ id: s, count: counts[s] ?? 0 });
    }
    return chips;
  }, [counts]);

  return (
    <div className="projects-board">
      <p className="projects-hint">
        Solo proyectos en curso. Al marcar <strong>Trabajo concluido</strong> (con foto de
        prueba), el proyecto sale de aquí y pasa a{' '}
        {onGoCompleted ? (
          <button type="button" className="projects-hint-link" onClick={onGoCompleted}>
            Concluidos ✓
          </button>
        ) : (
          <strong>Concluidos</strong>
        )}
        .
      </p>

      <div className="projects-filters">
        {visibleFilters.map(({ id, count }) => (
          <button
            key={id}
            type="button"
            className={`filter-chip project-filter-chip ${statusFilter === id ? 'active' : ''}`}
            style={
              id !== 'all'
                ? ({ '--chip-color': PROJECT_STATUS_COLORS[id] } as React.CSSProperties)
                : undefined
            }
            onClick={() => setStatusFilter(id)}
          >
            {id === 'all' ? 'Todos' : labelFor(PROJECT_STATUSES, id)}{' '}
            <span>{count}</span>
          </button>
        ))}
      </div>

      {canEditAll && (
        <button
          type="button"
          className="btn-primary projects-add-mobile"
          onClick={() => onSelect(addProject())}
        >
          + Nuevo proyecto
        </button>
      )}

      {filtered.length === 0 ? (
        <p className="projects-empty">No hay proyectos activos con ese filtro.</p>
      ) : (
        <div className="projects-sections">
          {projectGroups.map((group) => {
            let cardIndex = 0;
            return (
              <section key={group.id} className="projects-section">
                <h3 className="projects-subheading">
                  {group.title}
                  <span className="projects-subheading-count">{group.projects.length}</span>
                </h3>
                {group.note && <p className="projects-section-note">{group.note}</p>}
                <div className="projects-grid">
                  {group.projects.map((p) => {
                    const index = cardIndex++;
                    return (
                      <ProjectCard
                        key={p.id}
                        project={p}
                        index={index}
                        onOpen={() => onSelect(p)}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project: p,
  index,
  onOpen,
}: {
  project: CreativeProject;
  index: number;
  onOpen: () => void;
}) {
  const duration = calcProjectDurationDays(p.requestDate, p.commitmentDate, p.status);
  const accent = PROJECT_STATUS_COLORS[p.status];
  const collabLabel = labelFor(COLLABORATORS, p.collaborator);

  return (
    <article
      className="project-card"
      style={
        {
          '--card-accent': accent,
          '--stagger': `${Math.min(index, 12) * 40}ms`,
        } as React.CSSProperties
      }
      onClick={onOpen}
    >
      <div className="project-card-glow" aria-hidden />
      <header className="project-card-head">
        <div className="project-card-title-wrap">
          <h3>{p.projectName.trim() || 'Sin nombre'}</h3>
          <div className="project-card-badges">
            <span className="status-pill" style={{ background: accent }}>
              {labelFor(PROJECT_STATUSES, p.status)}
            </span>
            <span className={`priority-badge priority-badge--compact priority-badge--${p.priority}`}>
              {p.priority === 'alta_urgente' ? 'Urgente' : p.priority === 'media' ? 'Media' : 'Baja'}
            </span>
          </div>
        </div>
      </header>

      <p className="project-card-sub">
        {labelFor(BUSINESS_UNITS, p.businessUnit)} · {labelFor(PROJECT_TYPES, p.projectType)}
      </p>

      <div className="project-card-meta">
        <div className="meta-block">
          <span className="meta-label">Colaborador</span>
          <strong>{collabLabel}</strong>
        </div>
        <div className="meta-block">
          <span className="meta-label">Área interna</span>
          <strong>{labelFor(INTERNAL_AREAS, p.internalArea)}</strong>
        </div>
      </div>

      <div className="project-card-request">
        <span>Solicita: {p.requestedBy || '—'}</span>
        <span>{labelFor(REQUESTING_DEPARTMENTS, p.requestingDepartment)}</span>
      </div>

      <div className="project-card-dates">
        <span>
          <em>Solicitud</em> {formatShortDate(p.requestDate)}
        </span>
        <span>
          <em>Compromiso</em> {formatShortDate(p.commitmentDate)}
        </span>
        {duration !== null && (
          <span className="duration-tag">{formatDuration(duration)}</span>
        )}
      </div>

      {p.comments && <p className="project-card-comment">{p.comments}</p>}

      {(p.attachmentCount ?? p.attachments?.length ?? 0) > 0 && (
        <span className="project-card-files">
          📎 {p.attachmentCount ?? p.attachments!.length} archivo
          {(p.attachmentCount ?? p.attachments!.length) > 1 ? 's' : ''}
        </span>
      )}

      <span className="project-card-cta">Ver detalles →</span>
    </article>
  );
}
