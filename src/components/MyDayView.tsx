import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { STATUS_COLORS, STATUS_LABELS } from '../constants';
import {
  PROJECT_STATUS_COLORS,
  PROJECT_STATUSES,
  labelFor,
} from '../data/projectOptions';
import { assignmentTaskLine } from '../utils/assignmentBrief';
import { isActiveProject } from '../utils/activeItems';
import { formatShortDate } from '../utils/formatDate';
import { formatDeadlineClock, getProjectTimelineInfo, projectDueDate } from '../utils/projectTimeline';
import { useSharedNowSlow } from '../hooks/useSharedNow';
import {
  findProjectForTask,
  sortProjectsByUrgency,
  taskDuplicatesProject,
} from '../utils/projectLink';
import { OfficeOvertimePanel } from './OfficeOvertimePanel';
import { ActivityFeedPanel } from './ActivityFeedPanel';
import { HomeObservationsPanel } from './HomeObservationsPanel';
import { KpiObjectiveInbox } from './KpiObjectiveInbox';
import { buildPersonalObservationForEmployee } from '../utils/personalObservations';
import type { CreativeProject, EmployeeTask } from '../types';
import './MyDayView.css';
import './ProjectTimelineCountdown.css';

interface Props {
  onGoAssignments: () => void;
  onGoCalendar: () => void;
  onGoProjects: () => void;
  onGoCompleted: () => void;
  onGoKpis: () => void;
  onOpenTask: (task: EmployeeTask) => void;
  onOpenProject: (project: CreativeProject) => void;
  onCompleteProject: (project: CreativeProject) => void;
}

const PROJECT_PREVIEW_LIMIT = 4;

export function MyDayView({
  onGoAssignments,
  onGoCalendar,
  onGoProjects,
  onGoCompleted,
  onGoKpis,
  onOpenTask,
  onOpenProject,
  onCompleteProject,
}: Props) {
  const {
    user,
    board,
    visibleProjects,
    myPendingAssignments,
    myPendingKpiObjectives,
    calendar,
    activityFeed,
    marketingTasks,
    dailyKpiStore,
    allProjects,
    attendanceStore,
  } = useApp();

  const myActivity = useMemo(
    () =>
      activityFeed.filter(
        (e) =>
          e.actorName === user?.name ||
          e.message.includes(user?.name ?? '___') ||
          e.kind === 'assignment_sent',
      ),
    [activityFeed, user?.name],
  );

  const myTask = useMemo(
    () => board.tasks.find((t) => t.employeeId === user?.employeeId),
    [board.tasks, user?.employeeId],
  );

  const myProjects = useMemo(
    () => sortProjectsByUrgency(visibleProjects.filter(isActiveProject)),
    [visibleProjects],
  );

  const daySummary = useMemo(() => {
    let overdue = 0;
    let dueSoon = 0;
    for (const p of myProjects) {
      const d = getProjectTimelineInfo(p);
      if (d.tone === 'overdue') overdue += 1;
      else if (d.tone === 'urgent' || d.tone === 'soon') dueSoon += 1;
    }
    return {
      total: myProjects.length,
      overdue,
      dueSoon,
      assignments: myPendingAssignments.length,
      kpiObjectives: myPendingKpiObjectives.length,
    };
  }, [myProjects, myPendingAssignments.length, myPendingKpiObjectives.length]);

  const taskSummary = myTask ? assignmentTaskLine(myTask.objective) : '';

  const linkedProject = useMemo(
    () => (myTask ? findProjectForTask(myTask, myProjects) : undefined),
    [myTask, myProjects],
  );

  const hideTaskSection = useMemo(
    () => taskDuplicatesProject(myTask, myProjects),
    [myTask, myProjects],
  );

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayEvents = useMemo(
    () =>
      calendar.events
        .filter((e) => e.date === todayKey && !e.done)
        .sort((a, b) => a.time.localeCompare(b.time)),
    [calendar.events, todayKey],
  );

  const personalObservation = useMemo(() => {
    if (!user?.employeeId) return null;
    return buildPersonalObservationForEmployee(user.employeeId, {
      tasks: marketingTasks,
      dailyKpiStore,
      allProjects,
      attendanceStore,
      activeProjects: myProjects,
    });
  }, [
    user?.employeeId,
    marketingTasks,
    dailyKpiStore,
    allProjects,
    attendanceStore,
    myProjects,
  ]);

  const nextAction = useMemo(() => {
    if (myPendingKpiObjectives.length > 0) {
      const k = myPendingKpiObjectives[0];
      return {
        kind: 'kpi' as const,
        title: 'Objetivo KPI del mes',
        detail: `${k.assignedByName} · vence ${formatShortDate(k.dueDate)}`,
        actionLabel: 'Aceptar',
        onAction: onGoKpis,
      };
    }
    if (myPendingAssignments.length > 0) {
      const a = myPendingAssignments[0];
      return {
        kind: 'assignment' as const,
        title: a.title,
        detail: `Indicación · ${formatShortDate(a.dueDate)}`,
        actionLabel: 'Revisar',
        onAction: onGoAssignments,
      };
    }
    const overdue = myProjects.find(
      (p) => getProjectTimelineInfo(p).tone === 'overdue',
    );
    if (overdue) {
      return {
        kind: 'project' as const,
        title: overdue.projectName.trim() || 'Proyecto sin nombre',
        detail: 'Con retraso — entrega con foto',
        actionLabel: 'Entregar',
        onAction: () => onCompleteProject(overdue),
      };
    }
    if (myProjects.length > 0) {
      const p = myProjects[0];
      return {
        kind: 'project' as const,
        title: p.projectName.trim() || 'Proyecto sin nombre',
        detail: `Compromiso ${formatShortDate(p.commitmentDate)}`,
        actionLabel: 'Ver',
        onAction: () => onOpenProject(p),
      };
    }
    return null;
  }, [
    myPendingKpiObjectives,
    myPendingAssignments,
    myProjects,
    onGoKpis,
    onGoAssignments,
    onCompleteProject,
    onOpenProject,
  ]);

  const showUrgentBlock =
    myPendingAssignments.length > 1 ||
    (myPendingAssignments.length === 1 && nextAction?.kind !== 'assignment');

  const previewProjects = myProjects.slice(0, PROJECT_PREVIEW_LIMIT);
  const hasMoreProjects = myProjects.length > PROJECT_PREVIEW_LIMIT;

  const hasStats =
    daySummary.total > 0 ||
    daySummary.assignments > 0 ||
    daySummary.kpiObjectives > 0;

  return (
    <div className="my-day my-day--compact">
      <div className="my-day-top">
        {hasStats && (
          <div className="my-day-stats" role="status" aria-label="Resumen rápido">
            {daySummary.kpiObjectives > 0 && (
              <span className="my-day-stat my-day-stat--warn">KPI {daySummary.kpiObjectives}</span>
            )}
            {daySummary.assignments > 0 && (
              <span className="my-day-stat my-day-stat--warn">
                Indic. {daySummary.assignments}
              </span>
            )}
            {daySummary.total > 0 && (
              <span className="my-day-stat">Activos {daySummary.total}</span>
            )}
            {daySummary.overdue > 0 && (
              <span className="my-day-stat my-day-stat--danger">
                Retraso {daySummary.overdue}
              </span>
            )}
            {daySummary.dueSoon > 0 && (
              <span className="my-day-stat my-day-stat--soon">
                Pronto {daySummary.dueSoon}
              </span>
            )}
          </div>
        )}

        {nextAction && (
          <section className="my-day-next my-day-next--inline" aria-label="Siguiente paso">
            <div className="my-day-next-copy">
              <span className="my-day-next-label">Siguiente</span>
              <strong>{nextAction.title}</strong>
              <span>{nextAction.detail}</span>
            </div>
            <button type="button" className="btn-primary my-day-next-btn" onClick={nextAction.onAction}>
              {nextAction.actionLabel}
            </button>
          </section>
        )}
      </div>

      <KpiObjectiveInbox compact onGoKpis={onGoKpis} />

      {showUrgentBlock && (
        <section className="my-day-block my-day-urgent my-day-block--tight">
          <div className="my-day-block-head">
            <h2>Indicaciones pendientes</h2>
            <button type="button" className="btn-ghost my-day-link-all" onClick={onGoAssignments}>
              Ver todas →
            </button>
          </div>
          <p className="my-day-urgent-count">
            {myPendingAssignments.length} por aceptar del gerente
          </p>
        </section>
      )}

      <div className="my-day-grid">
        <div className="my-day-main">
          <section className="my-day-block my-day-projects-block my-day-block--tight">
            <div className="my-day-block-head">
              <h2>Por entregar</h2>
              <div className="my-day-head-links">
                <button type="button" className="btn-ghost my-day-link-all" onClick={onGoProjects}>
                  Proyectos →
                </button>
                <button type="button" className="btn-ghost my-day-link-all" onClick={onGoCompleted}>
                  Concluidos →
                </button>
              </div>
            </div>

            {myProjects.length === 0 ? (
              <p className="my-day-empty my-day-empty--inline">
                Sin proyectos pendientes.{' '}
                <button type="button" className="my-day-inline-link" onClick={onGoCompleted}>
                  Ver concluidos
                </button>
              </p>
            ) : (
              <>
                <ul className="my-day-project-list my-day-project-list--compact">
                  {previewProjects.map((p) => (
                    <MyDayProjectCard
                      key={p.id}
                      project={p}
                      onOpenProject={onOpenProject}
                      onCompleteProject={onCompleteProject}
                    />
                  ))}
                </ul>
                {hasMoreProjects && (
                  <button type="button" className="btn-ghost my-day-more-link" onClick={onGoProjects}>
                    +{myProjects.length - PROJECT_PREVIEW_LIMIT} más en Proyectos →
                  </button>
                )}
              </>
            )}
          </section>

          {myTask && !hideTaskSection && (
            <section className="my-day-block my-day-block--tight">
              <h2>{linkedProject ? 'Indicación vinculada' : 'Tu tablero'}</h2>
              {linkedProject ? (
                <div className="my-day-linked-row">
                  <span>{linkedProject.projectName.trim() || 'Sin nombre'}</span>
                  <button type="button" className="btn-primary btn-sm" onClick={() => onOpenProject(linkedProject)}>
                    Abrir
                  </button>
                </div>
              ) : (
                <button type="button" className="my-day-task-card my-day-task-card--compact" onClick={() => onOpenTask(myTask)}>
                  <span className="status-pill" style={{ background: STATUS_COLORS[myTask.status] }}>
                    {STATUS_LABELS[myTask.status]}
                  </span>
                  <strong>{myTask.currentWork}</strong>
                  {taskSummary && taskSummary !== myTask.currentWork && (
                    <span className="my-day-meta">{taskSummary}</span>
                  )}
                </button>
              )}
            </section>
          )}
        </div>

        <aside className="my-day-aside">
          <OfficeOvertimePanel mode="self" compact />

          {personalObservation && (
            <HomeObservationsPanel mode="personal" observation={personalObservation} compact />
          )}

          <section className="my-day-block my-day-block--tight my-day-agenda">
            <div className="my-day-block-head">
              <h2>Agenda hoy</h2>
              <button type="button" className="btn-ghost my-day-link-all" onClick={onGoCalendar}>
                Agenda →
              </button>
            </div>
            {todayEvents.length === 0 ? (
              <p className="my-day-empty my-day-empty--inline">Sin pendientes hoy.</p>
            ) : (
              <ul className="my-day-events my-day-events--compact">
                {todayEvents.slice(0, 4).map((e) => (
                  <li key={e.id}>
                    <span className="my-day-time">{e.time}</span>
                    <span>{e.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {myActivity.length > 0 && (
            <section className="my-day-block my-day-block--tight my-day-activity">
              <ActivityFeedPanel
                events={myActivity}
                limit={3}
                title="Actividad"
                emptyMessage=""
              />
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function MyDayProjectCard({
  project: p,
  onOpenProject,
  onCompleteProject,
}: {
  project: CreativeProject;
  onOpenProject: (p: CreativeProject) => void;
  onCompleteProject: (p: CreativeProject) => void;
}) {
  const now = useSharedNowSlow();
  const deadline = getProjectTimelineInfo(p, now);
  const due = projectDueDate(p);
  const clock = formatDeadlineClock(deadline);
  return (
    <li className="my-day-project-card my-day-project-card--compact">
      <div className="my-day-project-card-main">
        <div className="my-day-project-card-top">
          <span
            className="status-pill status-pill--sm"
            style={{ background: PROJECT_STATUS_COLORS[p.status] }}
          >
            {labelFor(PROJECT_STATUSES, p.status)}
          </span>
          <span className={`due-chip tone-${deadline.tone}`}>{deadline.label}</span>
          {clock && (
            <span className={`live-deadline-chip live-deadline-chip--${deadline.tone}`}>
              ⏱ {clock}
            </span>
          )}
        </div>
        <h3>{p.projectName.trim() || 'Sin nombre'}</h3>
        <p className="my-day-project-meta">
          {due ? `Entrega ${formatShortDate(due)}` : 'Sin fecha de entrega'}
          {p.requestedBy.trim() ? ` · ${p.requestedBy}` : ''}
        </p>
      </div>
      <div className="my-day-project-actions my-day-project-actions--compact">
        <button type="button" className="btn-ghost btn-sm" onClick={() => onOpenProject(p)}>
          Ver
        </button>
        <button
          type="button"
          className="my-day-btn-deliver my-day-btn-deliver--sm"
          onClick={() => onCompleteProject(p)}
        >
          Entregar
        </button>
      </div>
    </li>
  );
}
