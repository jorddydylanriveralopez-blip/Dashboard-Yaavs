import { displayNameForCollaborator } from '../data/teamDisplayNames';
import type { Collaborator, CreativeProject } from '../types';
import { calcProjectDurationDays } from './projectDuration';
import { projectIncludesCollaborator } from './projectCollaborators';
import { plannedProjectDays } from './projectHours';

export type SemaphoreLevel = 'green' | 'yellow' | 'red';

export interface CollaboratorSemaphore {
  collaborator: Collaborator;
  label: string;
  level: SemaphoreLevel;
  avgActualDays: number | null;
  avgPlannedDays: number | null;
  completedCount: number;
  activeCount: number;
  hoursExceededCount: number;
  message: string;
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

export function collaboratorLabel(slug: Collaborator): string {
  return displayNameForCollaborator(slug);
}

/** Semáforo según historial de días vs plazo y horas excedidas en activos. */
export function buildCollaboratorSemaphore(
  collaborator: Collaborator,
  allProjects: CreativeProject[],
): CollaboratorSemaphore {
  const mine = allProjects.filter((p) => projectIncludesCollaborator(p, collaborator));
  const completed = mine.filter((p) => p.status === 'terminado');
  const active = mine.filter((p) => p.status !== 'terminado');

  const actualDays = completed
    .map((p) => calcProjectDurationDays(p.requestDate, p.finishedDate ?? p.completedAt?.slice(0, 10), p.status))
    .filter((d): d is number => d !== null);

  const plannedDays = completed.map((p) => plannedProjectDays(p));
  const avgActual = avg(actualDays);
  const avgPlanned = avg(plannedDays);

  const hoursExceededCount = active.filter(
    (p) => (p.trackedMinutes ?? 0) > (p.estimatedHours ?? plannedProjectDays(p) * 8) * 60,
  ).length;

  let level: SemaphoreLevel = 'green';
  let message = 'Ritmo saludable en proyectos recientes.';

  if (hoursExceededCount > 0) {
    level = 'red';
    message = `${hoursExceededCount} proyecto(s) activo(s) superan las horas presupuestadas.`;
  } else if (avgActual !== null && avgPlanned !== null) {
    const ratio = avgActual / avgPlanned;
    if (ratio > 1.1) {
      level = 'red';
      message = `Suele tardar ${avgActual} días vs ${avgPlanned} días de plazo (más lento).`;
    } else if (ratio > 0.95) {
      level = 'yellow';
      message = `Promedio ${avgActual} días en plazos de ${avgPlanned} días — al límite.`;
    } else {
      level = 'green';
      message = `Entrega rápida: ${avgActual} días vs plazo de ${avgPlanned} días.`;
    }
  } else if (active.length > 2) {
    level = 'yellow';
    message = 'Varios proyectos activos — vigilar carga.';
  }

  return {
    collaborator,
    label: collaboratorLabel(collaborator),
    level,
    avgActualDays: avgActual,
    avgPlannedDays: avgPlanned,
    completedCount: completed.length,
    activeCount: active.length,
    hoursExceededCount,
    message,
  };
}

export const TRACKED_COLLABORATORS: Collaborator[] = [
  'roberto',
  'jorddy',
  'andres',
  'jesus',
  'andrea',
  'carlos',
  'yared',
];
