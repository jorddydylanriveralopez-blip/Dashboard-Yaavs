import {
  BUSINESS_UNITS,
  COLLABORATORS,
  INTERNAL_AREAS,
  labelFor,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  REQUESTING_DEPARTMENTS,
} from '../data/projectOptions';
import { MARKETING_DEPARTMENT } from '../data/seed';
import { employeeIdForCollaboratorSlug } from './collaboratorMap';
import { formatShortDate } from './formatDate';
import type {
  AssignmentBrief,
  Collaborator,
  CreativeProject,
  EmployeeTask,
  User,
} from '../types';

const BRIEF_SEPARATOR = '\n\n--- Datos de la solicitud ---\n';

/** Empleados de marketing a los que el jefe puede enviar indicaciones. */
export function assignableMarketingTasks(
  tasks: EmployeeTask[],
  activeUsers: User[],
): EmployeeTask[] {
  const empleadoIds = new Set(
    activeUsers
      .filter((u) => u.role === 'empleado' && u.employeeId)
      .map((u) => u.employeeId!),
  );
  return tasks.filter(
    (t) =>
      t.department === MARKETING_DEPARTMENT && empleadoIds.has(t.employeeId),
  );
}

export function employeeIdForCollaborator(
  collaborator: Collaborator,
  users: User[],
): string | undefined {
  return employeeIdForCollaboratorSlug(collaborator, users);
}

export function briefFromProject(project: CreativeProject): AssignmentBrief {
  return {
    projectId: project.id,
    projectName: project.projectName,
    requestDate: project.requestDate,
    businessUnit: project.businessUnit,
    requestedBy: project.requestedBy,
    requestingDepartment: project.requestingDepartment,
    projectType: project.projectType,
    projectPriority: project.priority,
    commitmentDate: project.commitmentDate,
    internalArea: project.internalArea,
    collaborator: project.collaborator,
    projectStatus: project.status,
    projectComments: project.comments,
  };
}

/** Texto legible con todos los campos del proyecto para la indicación. */
export function formatAssignmentBriefText(brief: AssignmentBrief): string {
  const name = brief.projectName.trim() || 'Proyecto creativo';
  const lines = [
    `Proyecto: ${name}`,
    `Fecha de solicitud: ${formatShortDate(brief.requestDate)}`,
    `Unidad de negocio: ${labelFor(BUSINESS_UNITS, brief.businessUnit)}`,
    `Solicitado por: ${brief.requestedBy.trim() || '—'}`,
    `Área solicitante: ${labelFor(REQUESTING_DEPARTMENTS, brief.requestingDepartment)}`,
    `Tipo de proyecto: ${labelFor(PROJECT_TYPES, brief.projectType)}`,
    `Prioridad del proyecto: ${labelFor(PROJECT_PRIORITIES, brief.projectPriority)}`,
    `Fecha de compromiso: ${formatShortDate(brief.commitmentDate)}`,
    `Área interna: ${labelFor(INTERNAL_AREAS, brief.internalArea)}`,
    `Colaborador en proyecto: ${labelFor(COLLABORATORS, brief.collaborator)}`,
  ];
  if (brief.projectStatus) {
    lines.push(`Estado del proyecto: ${labelFor(PROJECT_STATUSES, brief.projectStatus)}`);
  }
  if (brief.projectComments?.trim()) {
    lines.push(`Comentarios: ${brief.projectComments.trim()}`);
  }
  return lines.join('\n');
}

/** Resumen corto para notificaciones. */
export function assignmentBriefNotificationLine(brief: AssignmentBrief): string {
  return `${labelFor(BUSINESS_UNITS, brief.businessUnit)} · ${labelFor(REQUESTING_DEPARTMENTS, brief.requestingDepartment)}`;
}

/** Objetivo con la tarea y, debajo, todos los datos del proyecto. */
export function buildObjectiveFromProject(project: CreativeProject): string {
  const brief = briefFromProject(project);
  const displayName = project.projectName.trim() || 'Proyecto creativo';
  const taskLine =
    project.comments?.trim() ||
    `Entregar trabajo del proyecto «${displayName}» según los datos de la solicitud.`;
  return `${taskLine}${BRIEF_SEPARATOR}${formatAssignmentBriefText(brief)}`;
}

/** Solo la línea de tarea si el objetivo incluye el bloque de datos. */
export function assignmentTaskLine(objective: string): string {
  const obj = objective.trim();
  if (!obj) return '';
  const idx = obj.indexOf(BRIEF_SEPARATOR);
  if (idx >= 0) return obj.slice(0, idx).trim();
  return obj;
}

/** Prioridad de la indicación según la del proyecto creativo. */
export function assignmentPriorityFromProject(
  priority: CreativeProject['priority'],
): 'baja' | 'media' | 'alta' {
  if (priority === 'alta_urgente') return 'alta';
  if (priority === 'baja') return 'baja';
  return 'media';
}
