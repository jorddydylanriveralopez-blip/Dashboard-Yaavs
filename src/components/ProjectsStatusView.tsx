import { useMemo } from 'react';
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
import { calcProjectDurationDays, formatDuration } from '../utils/projectDuration';
import { sortProjectsByUrgency } from '../utils/projectLink';
import { ProjectHoursBadge } from './ProjectHoursBadge';
import type { CreativeProject } from '../types';
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
    fuzzyIncludes(p.completedByName ?? '', q)
  );
}

export function ProjectsStatusView({
  projects,
  completedProjects,
  filter,
  onSelect,
}: Props) {
  const { user, canEditAll, activeUsers } = useApp();
  const q = filter.trim();

  const visibleActive = useMemo(
    () => projects.filter((p) => projectVisibleToUser(p, user, canEditAll, activeUsers)),
    [projects, user, canEditAll, activeUsers],
  );

  const urgentProjects = useMemo(() => {
    const list = visibleActive.filter(
      (p) => p.priority === 'alta_urgente' && matchesSearch(p, q),
    );
    return sortProjectsByUrgency(list);
  }, [visibleActive, q]);

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
        Resumen rápido: proyectos <strong>urgentes</strong> pendientes de entrega y trabajos ya{' '}
        <strong>terminados</strong>.
      </p>

      <section className="projects-status-section projects-status-section--urgent">
        <header className="projects-status-head">
          <h3>Urgentes por terminar</h3>
          <span className="projects-status-count">{urgentProjects.length}</span>
        </header>
        {urgentProjects.length === 0 ? (
          <p className="projects-status-empty">No hay proyectos urgentes pendientes.</p>
        ) : (
          <ul className="projects-status-list">
            {urgentProjects.map((p) => {
              const deadline = getDeadlineInfo(p.commitmentDate, p.status);
              return (
                <li key={p.id}>
                  <button type="button" className="projects-status-card" onClick={() => onSelect(p)}>
                    <div className="projects-status-card-top">
                      <h4>{p.projectName.trim() || 'Sin nombre'}</h4>
                      <span className="projects-status-urgent-badge">Urgente</span>
                    </div>
                    <p className="projects-status-meta">
                      {labelFor(COLLABORATORS, p.collaborator)} ·{' '}
                      {labelFor(PROJECT_STATUSES, p.status)}
                    </p>
                    <p className={`projects-status-deadline projects-status-deadline--${deadline.tone}`}>
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

      <section className="projects-status-section projects-status-section--done">
        <header className="projects-status-head">
          <h3>Trabajos terminados</h3>
          <span className="projects-status-count">{finishedProjects.length}</span>
        </header>
        {finishedProjects.length === 0 ? (
          <p className="projects-status-empty">Aún no hay trabajos marcados como terminados.</p>
        ) : (
          <ul className="projects-status-list">
            {finishedProjects.map((p) => {
              const duration = calcProjectDurationDays(
                p.requestDate,
                p.finishedDate,
                p.status,
              );
              return (
                <li key={p.id}>
                  <button type="button" className="projects-status-card" onClick={() => onSelect(p)}>
                    <div className="projects-status-card-top">
                      <h4>{p.projectName.trim() || 'Sin nombre'}</h4>
                      <span
                        className="projects-status-done-badge"
                        style={{ background: PROJECT_STATUS_COLORS.terminado }}
                      >
                        Terminado
                      </span>
                    </div>
                    <p className="projects-status-meta">
                      {labelFor(COLLABORATORS, p.collaborator)}
                      {p.completedByName ? ` · Cerrado por ${p.completedByName}` : ''}
                    </p>
                    <p className="projects-status-deadline">
                      Finalizado:{' '}
                      {p.finishedDate ? formatShortDate(p.finishedDate) : '—'} · Duración:{' '}
                      {formatDuration(duration)}
                    </p>
                    {p.hasCompletionProof && (
                      <span className="projects-status-proof">📷 Con prueba de entrega</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
