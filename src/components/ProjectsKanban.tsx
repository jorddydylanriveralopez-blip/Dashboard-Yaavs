import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { projectVisibleToUser } from '../utils/collaboratorMap';
import {
  COLLABORATORS,
  labelFor,
  PROJECT_STATUSES,
  PROJECT_STATUS_COLORS,
} from '../data/projectOptions';
import { formatShortDate } from '../utils/formatDate';
import type { CreativeProject, ProjectStatus } from '../types';
import './ProjectsKanban.css';

const KANBAN_COLUMNS = PROJECT_STATUSES.map((s) => s.value).filter(
  (s) => s !== 'terminado',
);

interface Props {
  projects: CreativeProject[];
  onSelect: (project: CreativeProject) => void;
}

export function ProjectsKanban({ projects, onSelect }: Props) {
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

  return (
    <div className="projects-kanban">
      <p className="projects-kanban-hint">
        Arrastra las tarjetas entre columnas para cambiar el estado.{' '}
        {canEditAll ? 'Vista de pipeline del equipo.' : 'Solo tus proyectos.'}
      </p>
      <div className="kanban-board">
        {KANBAN_COLUMNS.map((status) => {
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
                {colProjects.map((p) => (
                  <li key={p.id}>
                    <article
                      className={`kanban-card ${dragId === p.id ? 'kanban-card--dragging' : ''}`}
                      draggable={canDrag(p)}
                      onDragStart={() => setDragId(p.id)}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => onSelect(p)}
                    >
                      <h4>{p.projectName.trim() || 'Sin nombre'}</h4>
                      <p>{labelFor(COLLABORATORS, p.collaborator)}</p>
                      <span>{formatShortDate(p.commitmentDate)}</span>
                    </article>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
