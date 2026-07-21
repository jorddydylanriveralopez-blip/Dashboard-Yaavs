import { useState } from 'react';
import type { CreativeProject, TaskAssignment, Collaborator } from '../types';
import type { PanoramaMemberDetail } from '../utils/panoramaDetail';
import {
  BUCKET_LABELS,
  BUCKET_ORDER,
  buildCollaboratorProjectBuckets,
  type CollaboratorProjectBucket,
} from '../utils/collaboratorProjectBuckets';
import {
  estimatedHoursForProject,
  formatHoursMinutes,
} from '../utils/projectHours';
import { labelFor, PROJECT_STATUSES } from '../data/projectOptions';
import { ASSIGNMENT_STATUS_LABELS } from '../constants';
import { ProjectTimelineCountdown } from './ProjectTimelineCountdown';
import { ManagerObservationBlock } from './ManagerObservationBlock';
import './PanoramaTeamBreakdown.css';
import './ManagerObservationBlock.css';
import './ProjectTimelineCountdown.css';

interface Props {
  members: PanoramaMemberDetail[];
  monthKey: string;
  allProjects: CreativeProject[];
  assignments?: TaskAssignment[];
}

export function MemberDetailSections({
  m,
  personal = false,
  hideProjects = false,
}: {
  m: PanoramaMemberDetail;
  personal?: boolean;
  hideProjects?: boolean;
}) {
  return (
    <div className="panorama-member-detail-grid">
      <div className="panorama-member-block panorama-member-block--detail">
        <h4>
          Inasistencias del mes
          {m.attendanceIssues.length > 0 && (
            <span className="panorama-detail-count">{m.attendanceIssues.length}</span>
          )}
        </h4>
        {m.attendanceIssues.length === 0 ? (
          <p className="panorama-detail-empty">Sin faltas, enfermedad ni retardos registrados.</p>
        ) : (
          <ul className="panorama-detail-list">
            {m.attendanceIssues.map((issue) => (
              <li
                key={`${issue.dateKey}-${issue.status}`}
                className={`panorama-detail-item panorama-detail-item--${issue.status}`}
              >
                <strong>{issue.dateLabel}</strong>
                <span>{issue.statusLabel}</span>
              </li>
            ))}
          </ul>
        )}
        {m.attendanceVacation > 0 && (
          <p className="panorama-detail-note">🌴 {m.attendanceVacation} día(s) de vacaciones.</p>
        )}
      </div>

      {!hideProjects && (
        <div className="panorama-member-block panorama-member-block--detail">
          <h4>
            Proyectos sin entregar
            {m.undeliveredProjects.length > 0 && (
              <span className="panorama-detail-count panorama-detail-count--warn">
                {m.undeliveredProjects.length}
              </span>
            )}
          </h4>
          {m.undeliveredProjects.length === 0 ? (
            <p className="panorama-detail-empty">
              {personal
                ? 'No tienes proyectos activos pendientes.'
                : 'No tiene proyectos activos pendientes.'}
            </p>
          ) : (
            <ul className="panorama-detail-list panorama-detail-list--projects">
              {m.undeliveredProjects.map((project) => (
                <li
                  key={project.id}
                  className={`panorama-detail-item panorama-detail-item--project${project.overdue ? ' is-overdue' : ''}`}
                >
                  <div>
                    <strong>{project.name}</strong>
                    <span>{project.statusLabel}</span>
                  </div>
                  <em>
                    Compromiso: {project.commitmentLabel} · {project.deadlineLabel}
                  </em>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function MemberProjectBucket({
  bucketKey,
  projects,
}: {
  bucketKey: CollaboratorProjectBucket;
  projects: CreativeProject[];
}) {
  if (projects.length === 0) return null;

  return (
    <div className={`panorama-bucket panorama-bucket--${bucketKey}`}>
      <h4>
        {BUCKET_LABELS[bucketKey]}
        <span>{projects.length}</span>
      </h4>
      <ul className="panorama-bucket-list">
        {projects.map((project) => (
          <li key={project.id} className="panorama-bucket-project">
            <div className="panorama-bucket-project-head">
              <div>
                <strong>{project.projectName.trim() || 'Sin nombre'}</strong>
                <span>{labelFor(PROJECT_STATUSES, project.status)}</span>
              </div>
              <div className="panorama-bucket-project-time">
                <strong>{formatHoursMinutes(project.trackedMinutes ?? 0)}</strong>
                <span>de {estimatedHoursForProject(project)} h</span>
              </div>
            </div>
            <ProjectTimelineCountdown
              project={project}
              compact
              showDates={false}
              className="panorama-bucket-timeline"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PanoramaTeamBreakdown({
  members,
  monthKey,
  allProjects,
  assignments = [],
}: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (members.length === 0) return null;

  return (
    <div className="panorama-breakdown panorama-breakdown--compact">
      {members.map((m, i) => {
        const isOpen = expanded === m.employeeId;
        const buckets = m.collaborator
          ? buildCollaboratorProjectBuckets(allProjects, m.collaborator as Collaborator)
          : null;
        const overdueCount =
          buckets?.overdue.length ??
          m.undeliveredProjects.filter((p) => p.overdue).length;
        const pendingCount = buckets?.allActive.length ?? m.undeliveredProjects.length;
        const finishingCount = buckets?.finishing.length ?? 0;
        const dueSoonCount = buckets?.dueSoon.length ?? 0;
        const pendingAssignments = assignments.filter(
          (a) => a.employeeId === m.employeeId && a.status === 'pending',
        );

        return (
          <article
            key={m.employeeId}
            className={`panorama-member-card panorama-member-card--${m.semaphoreLevel}${isOpen ? ' panorama-member-card--open' : ''}`}
            style={{ ['--member-i' as string]: i }}
          >
            <button
              type="button"
              className="panorama-member-toggle"
              onClick={() => setExpanded(isOpen ? null : m.employeeId)}
              aria-expanded={isOpen}
            >
              <span className="panorama-member-dot" style={{ background: m.color }} />
              <div className="panorama-member-title">
                <strong>{m.employeeName}</strong>
                {m.position && <span>{m.position}</span>}
              </div>
              <span className="panorama-member-chevron" aria-hidden>
                {isOpen ? '▾' : '▸'}
              </span>
            </button>

            {isOpen && (
              <div className="panorama-member-expanded">
                <header className="panorama-member-head">
                  <div className="panorama-member-kpi">
                    <strong>{m.kpiPercent} de 100</strong>
                    <span>Avance actual</span>
                  </div>
                </header>

                <p className="panorama-member-why">
                  Su color en el gráfico representa su avance actual: {m.kpiPercent} puntos de 100.
                  {m.kpiChange !== 0 && (
                    <>
                      {' '}
                      En el mes {m.kpiChange >= 0 ? 'subió' : 'bajó'} {Math.abs(m.kpiChange)} puntos.
                    </>
                  )}
                </p>

                <div className="panorama-member-tags panorama-member-tags--expanded">
                  {overdueCount > 0 && (
                    <span className="panorama-member-tag panorama-member-tag--overdue">
                      {overdueCount} atrasado{overdueCount === 1 ? '' : 's'}
                    </span>
                  )}
                  {pendingCount > 0 && (
                    <span className="panorama-member-tag panorama-member-tag--pending">
                      {pendingCount} pendiente{pendingCount === 1 ? '' : 's'}
                    </span>
                  )}
                  {finishingCount > 0 && (
                    <span className="panorama-member-tag panorama-member-tag--finishing">
                      {finishingCount} por concluir
                    </span>
                  )}
                  {dueSoonCount > 0 && (
                    <span className="panorama-member-tag panorama-member-tag--soon">
                      {dueSoonCount} próximo{dueSoonCount === 1 ? '' : 's'}
                    </span>
                  )}
                  {pendingAssignments.length > 0 && (
                    <span className="panorama-member-tag panorama-member-tag--asg">
                      {pendingAssignments.length} indicación
                      {pendingAssignments.length === 1 ? '' : 'es'}
                    </span>
                  )}
                </div>

                <div className="panorama-member-metrics">
                  <div className="panorama-metric">
                    <span className="panorama-metric-label">Entregas del mes</span>
                    <strong>
                      {m.projectsOnTime}/{m.projectsCompletedMonth} a tiempo
                    </strong>
                    <span>
                      {m.undeliveredProjects.length > 0
                        ? `${m.undeliveredProjects.length} sin entregar`
                        : m.projectsLate > 0
                          ? `${m.projectsLate} fuera de plazo`
                          : m.projectsCompletedMonth > 0
                            ? 'Todas a tiempo'
                            : 'Sin cierres este mes'}
                    </span>
                  </div>
                  <div className="panorama-metric">
                    <span className="panorama-metric-label">Horas de proyecto</span>
                    <strong>
                      {m.trackedHours}h / {m.estimatedHours}h
                    </strong>
                    <span>
                      {m.projectsHoursExceeded > 0
                        ? `${m.projectsHoursExceeded} activo(s) exceden presupuesto`
                        : `${m.hoursWithinBudget} dentro de presupuesto`}
                    </span>
                  </div>
                  <div className="panorama-metric">
                    <span className="panorama-metric-label">Asistencia</span>
                    <strong>{m.attendanceRate}%</strong>
                    <span>
                      {m.attendanceIssues.length > 0
                        ? `${m.attendanceIssues.length} incidencia(s) · ✓ ${m.attendancePresent}`
                        : `✓ ${m.attendancePresent} días`}
                    </span>
                  </div>
                  <div className="panorama-metric">
                    <span className="panorama-metric-label">Ritmo de avance</span>
                    <strong>
                      {m.daysUp}↑ · {m.daysDown}↓
                    </strong>
                    <span>{m.semaphoreMessage}</span>
                  </div>
                </div>

                {buckets && buckets.allActive.length > 0 ? (
                  <div className="panorama-member-projects">
                    <h3 className="panorama-member-projects-title">Proyectos en vivo</h3>
                    {BUCKET_ORDER.map((bucketKey) => (
                      <MemberProjectBucket
                        key={bucketKey}
                        bucketKey={bucketKey}
                        projects={buckets[bucketKey]}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="panorama-member-empty">Sin proyectos activos ahora.</p>
                )}

                {pendingAssignments.length > 0 && (
                  <div className="panorama-member-block panorama-member-block--detail">
                    <h4>
                      Indicaciones pendientes
                      <span className="panorama-detail-count panorama-detail-count--warn">
                        {pendingAssignments.length}
                      </span>
                    </h4>
                    <ul className="panorama-detail-list">
                      {pendingAssignments.map((a) => (
                        <li key={a.id} className="panorama-detail-item">
                          <strong>{a.title}</strong>
                          <span>{ASSIGNMENT_STATUS_LABELS[a.status]}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <MemberDetailSections m={m} hideProjects />

                <div className="panorama-member-block panorama-member-block--manager-note">
                  <ManagerObservationBlock
                    employeeId={m.employeeId}
                    employeeName={m.employeeName}
                    monthKey={monthKey}
                  />
                </div>

                {m.strengths.length > 0 && (
                  <div className="panorama-member-block panorama-member-block--good">
                    <h4>Fortalezas</h4>
                    <ul>
                      {m.strengths.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {m.improvements.length > 0 && (
                  <div className="panorama-member-block panorama-member-block--warn">
                    <h4>Áreas a mejorar</h4>
                    <ul>
                      {m.improvements.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
