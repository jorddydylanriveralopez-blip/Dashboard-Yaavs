import { useMemo, type CSSProperties } from 'react';
import { useApp } from '../context/AppContext';
import { projectVisibleToUser } from '../utils/collaboratorMap';
import {
  COLLABORATORS,
  labelFor,
  PROJECT_STATUSES,
  PROJECT_STATUS_COLORS,
} from '../data/projectOptions';
import { formatShortDate } from '../utils/formatDate';
import { fuzzyIncludes } from '../utils/fuzzyMatch';
import { getDeadlineInfo } from '../utils/deadline';
import { sortProjectsByUrgency } from '../utils/projectLink';
import { labelForProjectCollaborators } from '../utils/projectCollaborators';
import { ProjectHoursBadge } from './ProjectHoursBadge';
import type { CreativeProject, ProjectStatus } from '../types';
import './ProjectsStatusView.css';

interface Props {
  projects: CreativeProject[];
  completedProjects: CreativeProject[];
  filter: string;
  onSelect: (project: CreativeProject) => void;
}

function matchesSearch(p: CreativeProject, q: string): boolean {
  if (!q) return true;
  return (
    fuzzyIncludes(p.projectName, q) ||
    fuzzyIncludes(p.requestedBy, q) ||
    fuzzyIncludes(labelFor(COLLABORATORS, p.collaborator), q) ||
    fuzzyIncludes(labelForProjectCollaborators(p), q) ||
    fuzzyIncludes(p.completedByName ?? '', q)
  );
}

const ACTIVE_STATUSES = PROJECT_STATUSES.filter((s) => s.value !== 'terminado');

export function ProjectsStatusView({
  projects,
  completedProjects,
  filter,
  onSelect,
}: Props) {
  const { user, canEditAll, activeUsers } = useApp();
  const q = filter.trim();

  const visibleActive = useMemo(
    () =>
      projects.filter(
        (p) =>
          p.status !== 'terminado' &&
          projectVisibleToUser(p, user, canEditAll, activeUsers) &&
          matchesSearch(p, q),
      ),
    [projects, user, canEditAll, activeUsers, q],
  );

  const byStatus = useMemo(() => {
    const map = new Map<ProjectStatus, CreativeProject[]>();
    for (const s of ACTIVE_STATUSES) map.set(s.value, []);
    for (const p of visibleActive) {
      const list = map.get(p.status);
      if (list) list.push(p);
      else {
        // Estatus raro/legacy: meter en "Nuevo" para no perderlo.
        map.get('nuevo')?.push(p);
      }
    }
    for (const [status, list] of map) {
      map.set(status, sortProjectsByUrgency(list));
    }
    return map;
  }, [visibleActive]);

  const finishedProjects = useMemo(() => {
    const list = completedProjects.filter((p) => matchesSearch(p, q));
    return [...list].sort((a, b) => {
      const da = a.finishedDate ?? a.completedAt ?? a.updatedAt;
      const db = b.finishedDate ?? b.completedAt ?? b.updatedAt;
      return db.localeCompare(da);
    });
  }, [completedProjects, q]);

  return (
    <div className="projects-status">
      <p className="projects-status-hint">
        Tus trabajos por <strong>estatus</strong>. Aunque una columna esté vacía, la ves para
        saber cómo va el progreso. Cuando Orlando cambia el estatus, se actualiza aquí.
      </p>

      <div className="projects-status-columns">
        {ACTIVE_STATUSES.map(({ value, label }) => {
          const list = byStatus.get(value) ?? [];
          const color = PROJECT_STATUS_COLORS[value];
          return (
            <section
              key={value}
              className="projects-status-section"
              style={{ '--status-accent': color } as CSSProperties}
            >
              <header className="projects-status-head">
                <span
                  className="projects-status-dot"
                  style={{ background: color }}
                  aria-hidden
                />
                <h3>{label}</h3>
                <span className="projects-status-count">{list.length}</span>
              </header>
              {list.length === 0 ? (
                <p className="projects-status-empty">Sin proyectos en este estatus</p>
              ) : (
                <ul className="projects-status-list">
                  {list.map((p) => {
                    const deadline = getDeadlineInfo(p.commitmentDate, p.status);
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="projects-status-card"
                          onClick={() => onSelect(p)}
                        >
                          <div className="projects-status-card-top">
                            <h4>{p.projectName.trim() || 'Sin nombre'}</h4>
                            {p.priority === 'alta_urgente' && (
                              <span className="projects-status-urgent-badge">Urgente</span>
                            )}
                          </div>
                          <p className="projects-status-meta">
                            {labelForProjectCollaborators(p)}
                            {p.requestedBy ? ` · ${p.requestedBy}` : ''}
                          </p>
                          <p
                            className={`projects-status-deadline projects-status-deadline--${deadline.tone}`}
                          >
                            Solicitud {formatShortDate(p.requestDate)}
                            {p.finishedDate
                              ? ` · Finalizado ${formatShortDate(p.finishedDate)}`
                              : ` · ${deadline.label}`}
                          </p>
                          <ProjectHoursBadge project={p} compact />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <section className="projects-status-section projects-status-section--done">
        <header className="projects-status-head">
          <span
            className="projects-status-dot"
            style={{ background: PROJECT_STATUS_COLORS.terminado }}
            aria-hidden
          />
          <h3>Concluido</h3>
          <span className="projects-status-count">{finishedProjects.length}</span>
        </header>
        {finishedProjects.length === 0 ? (
          <p className="projects-status-empty">Sin proyectos concluidos todavía</p>
        ) : (
          <ul className="projects-status-list">
            {finishedProjects.slice(0, 12).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="projects-status-card"
                  onClick={() => onSelect(p)}
                >
                  <div className="projects-status-card-top">
                    <h4>{p.projectName.trim() || 'Sin nombre'}</h4>
                    <span
                      className="projects-status-done-badge"
                      style={{ background: PROJECT_STATUS_COLORS.terminado }}
                    >
                      Concluido
                    </span>
                  </div>
                  <p className="projects-status-meta">
                    {labelForProjectCollaborators(p)}
                    {p.completedByName ? ` · Cerrado por ${p.completedByName}` : ''}
                  </p>
                  <p className="projects-status-deadline">
                    Finalizado:{' '}
                    {p.finishedDate ? formatShortDate(p.finishedDate) : '—'}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
