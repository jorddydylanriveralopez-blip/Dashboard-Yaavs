import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { STATUS_COLORS, STATUS_LABELS } from '../constants';
import {
  PROJECT_STATUS_COLORS,
  PROJECT_STATUSES,
  labelFor,
} from '../data/projectOptions';
import { AssignmentBriefDetails } from './AssignmentBriefDetails';
import { FileAttachmentsList } from './FileAttachments';
import { assignmentTaskLine } from '../utils/assignmentBrief';
import { isActiveProject } from '../utils/activeItems';
import { formatShortDate } from '../utils/formatDate';
import { getDeadlineInfo } from '../utils/deadline';
import {
  findProjectForTask,
  sortProjectsByUrgency,
  taskDuplicatesProject,
} from '../utils/projectLink';
import { ActivityFeedPanel } from './ActivityFeedPanel';
import { KpiObjectiveInbox } from './KpiObjectiveInbox';
import type { CreativeProject, EmployeeTask } from '../types';
import './MyDayView.css';

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
      const d = getDeadlineInfo(p.commitmentDate, 'en_progreso');
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

  const nextAction = useMemo(() => {
    if (myPendingKpiObjectives.length > 0) {
      const k = myPendingKpiObjectives[0];
      return {
        kind: 'kpi' as const,
        title: 'Objetivo KPI del mes',
        detail: `${k.assignedByName} te asignó una meta para cumplir antes del ${formatShortDate(k.dueDate)}`,
        actionLabel: 'Aceptar objetivo',
        onAction: onGoKpis,
      };
    }
    if (myPendingAssignments.length > 0) {
      const a = myPendingAssignments[0];
      return {
        kind: 'assignment' as const,
        title: a.title,
        detail: `Indicación del gerente · vence ${formatShortDate(a.dueDate)}`,
        actionLabel: 'Revisar y aceptar',
        onAction: onGoAssignments,
      };
    }
    const overdue = myProjects.find(
      (p) => getDeadlineInfo(p.commitmentDate, 'en_progreso').tone === 'overdue',
    );
    if (overdue) {
      return {
        kind: 'project' as const,
        title: overdue.projectName.trim() || 'Proyecto sin nombre',
        detail: 'Tiene retraso — prioriza la entrega con foto',
        actionLabel: 'Entregar ahora',
        onAction: () => onCompleteProject(overdue),
      };
    }
    if (myProjects.length > 0) {
      const p = myProjects[0];
      return {
        kind: 'project' as const,
        title: p.projectName.trim() || 'Proyecto sin nombre',
        detail: `Compromiso ${formatShortDate(p.commitmentDate)}`,
        actionLabel: 'Ver proyecto',
        onAction: () => onOpenProject(p),
      };
    }
    return null;
  }, [myPendingKpiObjectives, myPendingAssignments, myProjects, onGoKpis, onGoAssignments, onCompleteProject, onOpenProject]);

  return (
    <div className="my-day">
      <KpiObjectiveInbox compact onGoKpis={onGoKpis} />

      {nextAction && (
        <section className="my-day-next" aria-label="Siguiente paso">
          <span className="my-day-next-label">Tu siguiente paso</span>
          <h2>{nextAction.title}</h2>
          <p>{nextAction.detail}</p>
          <button type="button" className="btn-primary" onClick={nextAction.onAction}>
            {nextAction.actionLabel}
          </button>
        </section>
      )}

      {daySummary.total > 0 || daySummary.assignments > 0 || daySummary.kpiObjectives > 0 ? (
        <div className="my-day-summary" role="status">
          {daySummary.kpiObjectives > 0 && (
            <span className="my-day-summary-chip my-day-summary-chip--warn">
              Objetivo KPI por aceptar
            </span>
          )}
          {daySummary.assignments > 0 && (
            <span className="my-day-summary-chip my-day-summary-chip--warn">
              {daySummary.assignments} indicación
              {daySummary.assignments > 1 ? 'es' : ''} por aceptar
            </span>
          )}
          {daySummary.total > 0 && (
            <span className="my-day-summary-chip">
              {daySummary.total} por entregar
            </span>
          )}
          {daySummary.overdue > 0 && (
            <span className="my-day-summary-chip my-day-summary-chip--danger">
              {daySummary.overdue} con retraso
            </span>
          )}
          {daySummary.dueSoon > 0 && (
            <span className="my-day-summary-chip my-day-summary-chip--soon">
              {daySummary.dueSoon} vencen pronto
            </span>
          )}
        </div>
      ) : null}

      {myPendingAssignments.length > 0 && (
        <section className="my-day-block my-day-urgent">
          <h2>Requiere tu atención</h2>
          <p>
            Tienes {myPendingAssignments.length} indicación
            {myPendingAssignments.length > 1 ? 'es' : ''} del gerente
          </p>
          {myPendingAssignments[0] && (
            <div className="my-day-assign-preview">
              <h3>{myPendingAssignments[0].title}</h3>
              {myPendingAssignments[0].brief && (
                <AssignmentBriefDetails brief={myPendingAssignments[0].brief} compact />
              )}
              {(myPendingAssignments[0].attachments?.length ?? 0) > 0 && (
                <FileAttachmentsList
                  attachments={myPendingAssignments[0].attachments ?? []}
                  compact
                />
              )}
            </div>
          )}
          <button type="button" className="btn-primary" onClick={onGoAssignments}>
            Revisar y aceptar
          </button>
        </section>
      )}

      <section className="my-day-block my-day-projects-block">
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
        <p className="my-day-section-sub">
          Solo aparecen proyectos <strong>asignados a ti</strong>. La barra verde es el botón para
          cerrar el trabajo (con foto), no significa que ya esté hecho. Cuando entregas, el proyecto
          pasa a <strong>Concluidos ✓</strong>.
        </p>

        {myProjects.length === 0 ? (
          <div className="my-day-empty-block">
            <p className="my-day-empty">No tienes proyectos pendientes por entregar.</p>
            <button type="button" className="btn-ghost" onClick={onGoCompleted}>
              Ver trabajos concluidos →
            </button>
          </div>
        ) : (
          <ul className="my-day-project-list">
            {myProjects.map((p) => (
              <MyDayProjectCard
                key={p.id}
                project={p}
                onOpenProject={onOpenProject}
                onCompleteProject={onCompleteProject}
              />
            ))}
          </ul>
        )}
      </section>

      {myTask && !hideTaskSection && (
        <section className="my-day-block">
          <h2>
            {linkedProject ? 'Indicación vinculada al proyecto' : 'Indicación en tu tablero'}
          </h2>
          {linkedProject ? (
            <>
              <p className="my-day-section-sub">
                Tu indicación aceptada corresponde al proyecto{' '}
                <strong>{linkedProject.projectName.trim() || 'Sin nombre'}</strong>. Gestiona la
                entrega desde <strong>Por entregar</strong> (foto + Trabajo concluido).
              </p>
              <div className="my-day-linked-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => onOpenProject(linkedProject)}
                >
                  Abrir proyecto
                </button>
                <button type="button" className="btn-ghost" onClick={() => onOpenTask(myTask)}>
                  Ver tablero Equipo
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              className="my-day-task-card"
              onClick={() => onOpenTask(myTask)}
            >
              <span
                className="status-pill"
                style={{ background: STATUS_COLORS[myTask.status] }}
              >
                {STATUS_LABELS[myTask.status]}
              </span>
              <strong>{myTask.currentWork}</strong>
              {taskSummary && taskSummary !== myTask.currentWork && (
                <span className="my-day-meta">{taskSummary}</span>
              )}
              {myTask.assignedByName && (
                <span className="my-day-assigned">
                  Indicación de {myTask.assignedByName}
                </span>
              )}
              <span
                className={`due-chip tone-${getDeadlineInfo(myTask.dueDate, myTask.status).tone}`}
              >
                {getDeadlineInfo(myTask.dueDate, myTask.status).label}
              </span>
            </button>
          )}
        </section>
      )}

      <section className="my-day-block">
        <h2>Agenda de hoy</h2>
        {todayEvents.length === 0 ? (
          <p className="my-day-empty">Sin pendientes en el calendario para hoy.</p>
        ) : (
          <ul className="my-day-events">
            {todayEvents.map((e) => (
              <li key={e.id}>
                <span className="my-day-time">{e.time}</span>
                <span>{e.title}</span>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btn-ghost" onClick={onGoCalendar}>
          Ver calendario completo
        </button>
      </section>

      {myActivity.length > 0 && (
        <section className="my-day-block">
          <ActivityFeedPanel
            events={myActivity}
            limit={5}
            title="Actividad que te involucra"
            emptyMessage=""
          />
        </section>
      )}
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
  const deadline = getDeadlineInfo(p.commitmentDate, 'en_progreso');
  return (
    <li className="my-day-project-card">
      <div className="my-day-project-card-top">
        <span
          className="status-pill"
          style={{ background: PROJECT_STATUS_COLORS[p.status] }}
        >
          {labelFor(PROJECT_STATUSES, p.status)}
        </span>
        <span className={`due-chip tone-${deadline.tone}`}>{deadline.label}</span>
      </div>
      <h3>{p.projectName.trim() || 'Sin nombre'}</h3>
      <p className="my-day-project-meta">
        Compromiso: {formatShortDate(p.commitmentDate)}
        {p.requestedBy.trim() ? ` · ${p.requestedBy}` : ''}
      </p>
      <p className="my-day-card-pending" role="status">
        <span className="my-day-pending-dot" aria-hidden />
        Pendiente de entrega — aún no envías la foto de prueba
      </p>
      <div className="my-day-project-actions">
        <button type="button" className="btn-ghost" onClick={() => onOpenProject(p)}>
          Ver proyecto
        </button>
        <button
          type="button"
          className="my-day-btn-deliver"
          onClick={() => onCompleteProject(p)}
        >
          Entregar con foto →
        </button>
      </div>
    </li>
  );
}
