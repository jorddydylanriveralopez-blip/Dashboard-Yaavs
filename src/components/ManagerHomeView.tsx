import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  COLLABORATORS,
  labelFor,
  PROJECT_STATUS_COLORS,
  PROJECT_STATUSES,
} from '../data/projectOptions';
import { isActiveProject } from '../utils/activeItems';
import { getDeadlineInfo } from '../utils/deadline';
import { formatShortDate } from '../utils/formatDate';
import { countOverdueProjects, sortProjectsByUrgency } from '../utils/projectLink';
import type { CreativeProject } from '../types';
import './ManagerHomeView.css';

interface Props {
  projects: CreativeProject[];
  completedProjects: CreativeProject[];
  onGoProjects: () => void;
  onGoAssignments: () => void;
  onGoCompleted: () => void;
  onGoTeam: () => void;
  onOpenProject: (project: CreativeProject) => void;
}

export function ManagerHomeView({
  projects,
  completedProjects,
  onGoProjects,
  onGoAssignments,
  onGoCompleted,
  onGoTeam,
  onOpenProject,
}: Props) {
  const { assignments } = useApp();

  const activeProjects = useMemo(
    () => projects.filter(isActiveProject),
    [projects],
  );

  const overdueProjects = useMemo(
    () =>
      sortProjectsByUrgency(
        activeProjects.filter(
          (p) => getDeadlineInfo(p.commitmentDate, 'en_progreso').tone === 'overdue',
        ),
      ),
    [activeProjects],
  );

  const teamPending = useMemo(
    () => assignments.filter((a) => a.status === 'pending'),
    [assignments],
  );

  const recentCompleted = useMemo(
    () =>
      [...completedProjects]
        .sort((a, b) => {
          const da = a.finishedDate ?? a.completedAt ?? a.updatedAt;
          const db = b.finishedDate ?? b.completedAt ?? b.updatedAt;
          return db.localeCompare(da);
        })
        .slice(0, 5),
    [completedProjects],
  );

  const overdueCount = countOverdueProjects(activeProjects);

  return (
    <div className="manager-home">
      <section className="manager-home-kpis" aria-label="Resumen">
        <div className="manager-kpi manager-kpi--danger">
          <strong>{overdueCount}</strong>
          <span>Proyectos con retraso</span>
        </div>
        <div className="manager-kpi manager-kpi--warn">
          <strong>{teamPending.length}</strong>
          <span>Indicaciones sin aceptar</span>
        </div>
        <div className="manager-kpi manager-kpi--ok">
          <strong>{activeProjects.length}</strong>
          <span>En curso</span>
        </div>
        <div className="manager-kpi">
          <strong>{completedProjects.length}</strong>
          <span>Concluidos</span>
        </div>
      </section>

      <div className="manager-home-actions">
        <button type="button" className="btn-primary" onClick={onGoProjects}>
          Ver proyectos
        </button>
        <button type="button" className="btn-ghost" onClick={onGoAssignments}>
          Indicaciones
          {teamPending.length > 0 ? ` (${teamPending.length})` : ''}
        </button>
        <button type="button" className="btn-ghost" onClick={onGoTeam}>
          Equipo
        </button>
      </div>

      <section className="manager-home-block">
        <div className="manager-home-block-head">
          <h2>Proyectos atrasados</h2>
          <button type="button" className="btn-ghost manager-home-link" onClick={onGoProjects}>
            Todos →
          </button>
        </div>
        <p className="manager-home-sub">
          Pasaron la fecha de compromiso y siguen en curso. Prioriza estos con el equipo.
        </p>
        {overdueProjects.length === 0 ? (
          <p className="manager-home-empty">Ningún proyecto activo con retraso.</p>
        ) : (
          <ul className="manager-home-list">
            {overdueProjects.slice(0, 8).map((p) => (
              <ManagerProjectRow key={p.id} project={p} onOpen={() => onOpenProject(p)} />
            ))}
          </ul>
        )}
      </section>

      <section className="manager-home-block">
        <div className="manager-home-block-head">
          <h2>Indicaciones pendientes</h2>
          <button type="button" className="btn-ghost manager-home-link" onClick={onGoAssignments}>
            Gestionar →
          </button>
        </div>
        {teamPending.length === 0 ? (
          <p className="manager-home-empty">El equipo no tiene indicaciones por aceptar.</p>
        ) : (
          <ul className="manager-home-list manager-home-list--compact">
            {teamPending.slice(0, 6).map((a) => (
              <li key={a.id} className="manager-pending-row">
                <div>
                  <strong>{a.title}</strong>
                  <span className="manager-pending-meta">
                    Para {a.employeeName}
                    {a.brief?.projectName ? ` · ${a.brief.projectName}` : ''}
                  </span>
                </div>
                <span className="manager-pending-date">
                  Vence {formatShortDate(a.dueDate)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="manager-home-block">
        <div className="manager-home-block-head">
          <h2>Últimos concluidos</h2>
          <button type="button" className="btn-ghost manager-home-link" onClick={onGoCompleted}>
            Concluidos →
          </button>
        </div>
        {recentCompleted.length === 0 ? (
          <p className="manager-home-empty">Aún no hay entregas con prueba registradas.</p>
        ) : (
          <ul className="manager-home-list manager-home-list--compact">
            {recentCompleted.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="manager-completed-row"
                  onClick={() => onOpenProject(p)}
                >
                  <strong>{p.projectName.trim() || 'Sin nombre'}</strong>
                  <span>
                    {p.completedByName ?? labelFor(COLLABORATORS, p.collaborator)}
                    {p.finishedDate ? ` · ${formatShortDate(p.finishedDate)}` : ''}
                    {p.hasCompletionProof ? ' · Con prueba' : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ManagerProjectRow({
  project: p,
  onOpen,
}: {
  project: CreativeProject;
  onOpen: () => void;
}) {
  const deadline = getDeadlineInfo(p.commitmentDate, 'en_progreso');
  return (
    <li>
      <button type="button" className="manager-project-row" onClick={onOpen}>
        <div className="manager-project-row-top">
          <span
            className="status-pill"
            style={{ background: PROJECT_STATUS_COLORS[p.status] }}
          >
            {labelFor(PROJECT_STATUSES, p.status)}
          </span>
          <span className={`due-chip tone-${deadline.tone}`}>{deadline.label}</span>
        </div>
        <strong>{p.projectName.trim() || 'Sin nombre'}</strong>
        <span className="manager-project-row-meta">
          {labelFor(COLLABORATORS, p.collaborator)} · Compromiso{' '}
          {formatShortDate(p.commitmentDate)}
        </span>
      </button>
    </li>
  );
}
