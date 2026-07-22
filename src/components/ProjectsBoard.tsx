import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  BUSINESS_UNITS,
  COLLABORATORS,
  labelFor,
  PROJECT_STATUSES,
  PROJECT_STATUS_COLORS,
} from '../data/projectOptions';
import { fuzzyIncludes } from '../utils/fuzzyMatch';
import { isActiveProject } from '../utils/activeItems';
import {
  countByDeadlineFilter,
  DEADLINE_FILTERS,
  projectMatchesDeadlineFilter,
  type ProjectDeadlineFilter,
} from '../utils/projectDeadlineFilters';
import { ProjectsKanban } from './ProjectsKanban';
import { ProjectsStatusView } from './ProjectsStatusView';
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
  const { canEditAll, addProject, visibleCompletedProjects } = useApp();
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [deadlineFilter, setDeadlineFilter] = useState<ProjectDeadlineFilter>('all');
  const [layoutMode, setLayoutMode] = useState<'projects' | 'status'>(() =>
    canEditAll ? 'projects' : 'status',
  );
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
    if (deadlineFilter !== 'all') {
      list = list.filter((p) => projectMatchesDeadlineFilter(p, deadlineFilter));
    }
    if (!q) return list;
    return list.filter(
      (p) =>
        fuzzyIncludes(p.projectName, q) ||
        fuzzyIncludes(p.requestedBy, q) ||
        fuzzyIncludes(labelFor(COLLABORATORS, p.collaborator), q) ||
        fuzzyIncludes(labelFor(BUSINESS_UNITS, p.businessUnit), q),
    );
  }, [activeProjects, filter, statusFilter, deadlineFilter]);

  const deadlineCounts = useMemo(
    () => countByDeadlineFilter(activeProjects),
    [activeProjects],
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
      const count = counts[s] ?? 0;
      // Colaboradores ven todos los estatus (aunque vacíos) para transparencia.
      if (!canEditAll || count > 0) chips.push({ id: s, count });
    }
    return chips;
  }, [counts, canEditAll]);

  return (
    <div className="projects-board">
      <p className="projects-hint">
        {canEditAll ? (
          <>
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
          </>
        ) : (
          <>
            Solo ves proyectos <strong>asignados a ti</strong>, agrupados por estatus (Nuevo,
            En desarrollo, etc.). Si Orlando cambia el estatus, lo verás aquí al actualizar.
          </>
        )}
      </p>

      <div className="projects-layout-toggle" role="tablist" aria-label="Vista de proyectos">
        <button
          type="button"
          role="tab"
          aria-selected={layoutMode === 'projects'}
          className={`projects-layout-btn ${layoutMode === 'projects' ? 'active' : ''}`}
          onClick={() => setLayoutMode('projects')}
        >
          Proyectos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={layoutMode === 'status'}
          className={`projects-layout-btn ${layoutMode === 'status' ? 'active' : ''}`}
          onClick={() => setLayoutMode('status')}
        >
          Estatus
        </button>
      </div>

      {layoutMode === 'status' ? (
        <ProjectsStatusView
          projects={projects}
          completedProjects={visibleCompletedProjects}
          filter={filter}
          onSelect={onSelect}
        />
      ) : (
        <>
      <div className="projects-filters projects-filters--deadline">
        <span className="projects-filters-label">Plazo</span>
        <button
          type="button"
          className={`filter-chip project-filter-chip project-deadline-chip ${deadlineFilter === 'all' ? 'active' : ''}`}
          onClick={() => setDeadlineFilter('all')}
        >
          Todos <span>{deadlineCounts.all}</span>
        </button>
        {DEADLINE_FILTERS.map(({ id, label, tone }) => {
          const count = deadlineCounts[id];
          if (count === 0) return null;
          return (
            <button
              key={id}
              type="button"
              className={`filter-chip project-filter-chip project-deadline-chip project-deadline-chip--${tone} ${deadlineFilter === id ? 'active' : ''}`}
              onClick={() => setDeadlineFilter(id)}
            >
              {label} <span>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="projects-filters">
        <span className="projects-filters-label">Estatus</span>
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
        activeProjects.length === 0 ? (
          <div className="projects-empty projects-empty--start">
            <span className="projects-empty-icon" aria-hidden="true">
              ◆
            </span>
            <p className="projects-empty-title">Aún no hay proyectos</p>
            <p className="projects-empty-sub">
              {canEditAll
                ? 'El tablero está limpio. Crea un proyecto, llénalo y envíalo: solo entonces aparece aquí.'
                : 'Cuando el gerente te asigne un proyecto, aparecerá aquí.'}
            </p>
            {canEditAll && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => onSelect(addProject())}
              >
                + Crear primer proyecto
              </button>
            )}
          </div>
        ) : (
          <p className="projects-empty">No hay proyectos activos con ese filtro.</p>
        )
      ) : (
        <ProjectsKanban
          projects={filtered}
          onSelect={onSelect}
          statusFilter={statusFilter}
        />
      )}
        </>
      )}
    </div>
  );
}
