import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  COLLABORATORS,
  labelFor,
  PROJECT_STATUS_COLORS,
} from '../data/projectOptions';
import { formatShortDate } from '../utils/formatDate';
import { fuzzyIncludes } from '../utils/fuzzyMatch';
import { calcProjectDurationDays, formatDuration } from '../utils/projectDuration';
import type { CreativeProject } from '../types';
import './CompletedProjectsView.css';

interface Props {
  projects: CreativeProject[];
  filter: string;
  onSelect: (project: CreativeProject) => void;
}

export function CompletedProjectsView({ projects, filter, onSelect }: Props) {
  const { canEditAll } = useApp();

  const filtered = useMemo(() => {
    const q = filter.trim();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        fuzzyIncludes(p.projectName, q) ||
        fuzzyIncludes(p.requestedBy, q) ||
        fuzzyIncludes(labelFor(COLLABORATORS, p.collaborator), q) ||
        fuzzyIncludes(p.completedByName ?? '', q),
    );
  }, [projects, filter]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const da = a.finishedDate ?? a.completedAt ?? a.updatedAt;
        const db = b.finishedDate ?? b.completedAt ?? b.updatedAt;
        return db.localeCompare(da);
      }),
    [filtered],
  );

  return (
    <div className="completed-projects">
      <p className="completed-projects-hint">
        Aquí ves los proyectos marcados como <strong>Terminado</strong>.
        {canEditAll
          ? ' Abre uno para ver la prueba de entrega que subió el colaborador.'
          : ' Los que tú cerraste con evidencia de entrega aparecen con el distintivo de prueba.'}
      </p>
      <p className="completed-projects-hint-secondary">
        El menú <strong>Resultados del mes</strong> (◷) es el resumen mensual de KPIs, no la lista de
        proyectos.
      </p>

      {sorted.length === 0 ? (
        <div className="completed-projects-empty">
          <span className="completed-projects-empty-icon" aria-hidden>
            ✓
          </span>
          <p>No hay proyectos concluidos todavía.</p>
          <p className="completed-projects-empty-sub">
            Cuando marques el status como <strong>Terminado</strong> (o uses Trabajo concluido),
            el proyecto aparecerá aquí.
          </p>
        </div>
      ) : (
        <ul className="completed-projects-list">
          {sorted.map((p) => {
            const duration = calcProjectDurationDays(
              p.requestDate,
              p.finishedDate,
              p.status,
            );
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className="completed-project-card"
                  onClick={() => onSelect(p)}
                >
                  <div className="completed-project-card-head">
                    <h3>{p.projectName.trim() || 'Sin nombre'}</h3>
                    <span
                      className="completed-project-status"
                      style={{ background: PROJECT_STATUS_COLORS.terminado }}
                    >
                      Terminado
                    </span>
                  </div>
                  <p className="completed-project-meta">
                    {labelFor(COLLABORATORS, p.collaborator)}
                    {p.completedByName ? ` · Cerrado por ${p.completedByName}` : ''}
                  </p>
                  <div className="completed-project-dates">
                    <span>
                      Finalizado:{' '}
                      {p.finishedDate ? formatShortDate(p.finishedDate) : '—'}
                    </span>
                    <span>Duración: {formatDuration(duration)}</span>
                  </div>
                  {p.hasCompletionProof && (
                    <span className="completed-project-proof-badge">
                      📷 Con prueba de entrega
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
