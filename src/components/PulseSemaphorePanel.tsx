import { useState } from 'react';
import { ProjectTimelineCountdown } from './ProjectTimelineCountdown';
import type { CollaboratorSemaphore } from '../utils/collaboratorSemaphore';
import {
  BUCKET_LABELS,
  BUCKET_ORDER,
  buildCollaboratorProjectBuckets,
  type CollaboratorProjectBucket,
} from '../utils/collaboratorProjectBuckets';
import {
  estimatedHoursForProject,
  formatHoursMinutes,
  trackedHoursForProject,
} from '../utils/projectHours';
import { labelFor, PROJECT_STATUSES } from '../data/projectOptions';
import type { CreativeProject, Collaborator } from '../types';
import './PulseSemaphorePanel.css';

interface Props {
  semaphores: CollaboratorSemaphore[];
  allProjects: CreativeProject[];
}

export function PulseSemaphorePanel({ semaphores, allProjects }: Props) {
  const [expanded, setExpanded] = useState<Collaborator | null>(null);

  return (
    <section className="pulse-section pulse-section--animate pulse-semaphore-section">
      <h2>Semáforos de ritmo</h2>
      <p className="pulse-section-sub">
        Toca a alguien para ver sus proyectos, tiempo invertido y cronómetro. Incluye atrasados,
        por concluir y próximos a vencer.
      </p>
      <div className="pulse-semaphore-grid">
        {semaphores.map((semaphore, i) => {
          const buckets = buildCollaboratorProjectBuckets(allProjects, semaphore.collaborator);
          const isOpen = expanded === semaphore.collaborator;
          const totalTracked = Math.round(
            buckets.allActive.reduce((sum, p) => sum + trackedHoursForProject(p), 0) * 10,
          ) / 10;

          return (
            <article
              key={semaphore.collaborator}
              className={`pulse-semaphore-card pulse-semaphore-card--${semaphore.level}${isOpen ? ' pulse-semaphore-card--open' : ''}`}
              style={{ ['--sem-i' as string]: i }}
            >
              <button
                type="button"
                className="pulse-semaphore-card-toggle"
                onClick={() =>
                  setExpanded(isOpen ? null : semaphore.collaborator)
                }
                aria-expanded={isOpen}
              >
                <div className="pulse-semaphore-card-top">
                  <strong>
                    <span className="pulse-semaphore-light" aria-hidden />
                    {semaphore.label}
                  </strong>
                  <span className="pulse-semaphore-chevron" aria-hidden>
                    {isOpen ? '▾' : '▸'}
                  </span>
                </div>
                <p>{semaphore.message}</p>
                <div className="pulse-semaphore-tags">
                  {buckets.overdue.length > 0 && (
                    <span className="pulse-semaphore-tag pulse-semaphore-tag--overdue">
                      {buckets.overdue.length} atrasado{buckets.overdue.length === 1 ? '' : 's'}
                    </span>
                  )}
                  {buckets.finishing.length > 0 && (
                    <span className="pulse-semaphore-tag pulse-semaphore-tag--finishing">
                      {buckets.finishing.length} por concluir
                    </span>
                  )}
                  {buckets.dueSoon.length > 0 && (
                    <span className="pulse-semaphore-tag pulse-semaphore-tag--soon">
                      {buckets.dueSoon.length} próximo{buckets.dueSoon.length === 1 ? '' : 's'}
                    </span>
                  )}
                  <span className="pulse-semaphore-tag pulse-semaphore-tag--active">
                    {buckets.allActive.length} activo{buckets.allActive.length === 1 ? '' : 's'}
                  </span>
                </div>
                <span className="pulse-semaphore-meta">
                  {semaphore.completedCount} concluidos · {totalTracked}h en curso
                </span>
              </button>

              {isOpen && (
                <div className="pulse-semaphore-detail">
                  {buckets.allActive.length === 0 ? (
                    <p className="pulse-semaphore-empty">Sin proyectos activos ahora.</p>
                  ) : (
                    BUCKET_ORDER.map((bucketKey) => (
                      <SemaphoreBucket
                        key={bucketKey}
                        bucketKey={bucketKey}
                        projects={buckets[bucketKey]}
                      />
                    ))
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SemaphoreBucket({
  bucketKey,
  projects,
}: {
  bucketKey: CollaboratorProjectBucket;
  projects: CreativeProject[];
}) {
  if (projects.length === 0) return null;

  return (
    <div className={`pulse-semaphore-bucket pulse-semaphore-bucket--${bucketKey}`}>
      <h3>
        {BUCKET_LABELS[bucketKey]}
        <span>{projects.length}</span>
      </h3>
      <ul className="pulse-semaphore-project-list">
        {projects.map((project) => (
          <li key={project.id} className="pulse-semaphore-project">
            <div className="pulse-semaphore-project-head">
              <div>
                <strong>{project.projectName.trim() || 'Sin nombre'}</strong>
                <span>{labelFor(PROJECT_STATUSES, project.status)}</span>
              </div>
              <div className="pulse-semaphore-project-time">
                <strong>{formatHoursMinutes(project.trackedMinutes ?? 0)}</strong>
                <span>de {estimatedHoursForProject(project)} h</span>
              </div>
            </div>
            <ProjectTimelineCountdown
              project={project}
              compact
              showDates={false}
              className="pulse-semaphore-timeline"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
