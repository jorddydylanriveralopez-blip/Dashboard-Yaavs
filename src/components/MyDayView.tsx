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
import { collaboratorForUser } from '../utils/collaboratorMap';
import { formatShortDate } from '../utils/formatDate';
import { getDeadlineInfo } from '../utils/deadline';
import {
  findProjectForTask,
  sortProjectsByUrgency,
  taskDuplicatesProject,
} from '../utils/projectLink';
import type { CreativeProject, EmployeeTask } from '../types';
import './MyDayView.css';

interface Props {
  onGoAssignments: () => void;
  onGoCalendar: () => void;
  onGoProjects: () => void;
  onGoCompleted: () => void;
  onOpenTask: (task: EmployeeTask) => void;
  onOpenProject: (project: CreativeProject) => void;
  onCompleteProject: (project: CreativeProject) => void;
}

export function MyDayView({
  onGoAssignments,
  onGoCalendar,
  onGoProjects,
  onGoCompleted,
  onOpenTask,
  onOpenProject,
  onCompleteProject,
}: Props) {
  const {
    user,
    board,
    projects,
    myPendingAssignments,
    calendar,
  } = useApp();

  const myTask = useMemo(
    () => board.tasks.find((t) => t.employeeId === user?.employeeId),
    [board.tasks, user?.employeeId],
  );

  const myCollaborator = collaboratorForUser(user);

  /** Solo proyectos asignados a ti por nombre (Jorddy, Roberto, etc.). */
  const myProjectsDirect = useMemo(
    () =>
      sortProjectsByUrgency(
        projects.filter(
          (p) =>
            isActiveProject(p) &&
            myCollaborator !== null &&
            p.collaborator === myCollaborator,
        ),
      ),
    [projects, myCollaborator],
  );

  /** Proyectos con colaborador «TODOS»: los ve todo el equipo en Inicio. */
  const myProjectsTeam = useMemo(
    () =>
      sortProjectsByUrgency(
        projects.filter(
          (p) => isActiveProject(p) && p.collaborator === 'todos' && myCollaborator !== null,
        ),
      ),
    [projects, myCollaborator],
  );

  const allMyPending = useMemo(
    () => [...myProjectsDirect, ...myProjectsTeam],
    [myProjectsDirect, myProjectsTeam],
  );

  const daySummary = useMemo(() => {
    let overdue = 0;
    let dueSoon = 0;
    for (const p of allMyPending) {
      const d = getDeadlineInfo(p.commitmentDate, 'en_progreso');
      if (d.tone === 'overdue') overdue += 1;
      else if (d.tone === 'urgent' || d.tone === 'soon') dueSoon += 1;
    }
    return {
      total: allMyPending.length,
      overdue,
      dueSoon,
      assignments: myPendingAssignments.length,
    };
  }, [allMyPending, myPendingAssignments.length]);

  const taskSummary = myTask ? assignmentTaskLine(myTask.objective) : '';

  const activeVisible = useMemo(
    () => projects.filter(isActiveProject),
    [projects],
  );

  const linkedProject = useMemo(
    () => (myTask ? findProjectForTask(myTask, activeVisible) : undefined),
    [myTask, activeVisible],
  );

  const hideTaskSection = useMemo(
    () => taskDuplicatesProject(myTask, allMyPending),
    [myTask, allMyPending],
  );

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayEvents = useMemo(
    () =>
      calendar.events
        .filter((e) => e.date === todayKey && !e.done)
        .sort((a, b) => a.time.localeCompare(b.time)),
    [calendar.events, todayKey],
  );

  return (
    <div className="my-day">
      {daySummary.total > 0 || daySummary.assignments > 0 ? (
        <div className="my-day-summary" role="status">
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
          Aquí solo aparecen proyectos <strong>sin entregar</strong>. La barra verde de antes era un{' '}
          <strong>botón</strong> para cerrar el trabajo (con foto), no significa que ya esté hecho.
          Cuando entregas, el proyecto desaparece de aquí y pasa a <strong>Concluidos ✓</strong>. El
          rojo es <strong>retraso</strong> de fecha, no “terminado”.
        </p>

        {myProjectsDirect.length === 0 && myProjectsTeam.length === 0 ? (
          <div className="my-day-empty-block">
            <p className="my-day-empty">No tienes proyectos pendientes por entregar.</p>
            <button type="button" className="btn-ghost" onClick={onGoCompleted}>
              Ver trabajos concluidos →
            </button>
          </div>
        ) : (
          <>
            {myProjectsDirect.length > 0 && (
              <>
                <h3 className="my-day-subheading">Asignados a ti</h3>
                <ul className="my-day-project-list">
                  {myProjectsDirect.map((p) => (
                    <MyDayProjectCard
                      key={p.id}
                      project={p}
                      onOpenProject={onOpenProject}
                      onCompleteProject={onCompleteProject}
                    />
                  ))}
                </ul>
              </>
            )}
            {myProjectsTeam.length > 0 && (
              <>
                <h3 className="my-day-subheading">Todo el equipo (colaborador TODOS)</h3>
                <p className="my-day-team-note">
                  Estos los ve cualquier miembro del equipo; concluye solo si te corresponde.
                </p>
                <ul className="my-day-project-list">
                  {myProjectsTeam.map((p) => (
                    <MyDayProjectCard
                      key={p.id}
                      project={p}
                      onOpenProject={onOpenProject}
                      onCompleteProject={onCompleteProject}
                    />
                  ))}
                </ul>
              </>
            )}
          </>
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
