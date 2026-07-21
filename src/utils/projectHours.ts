import type { CreativeProject } from '../types';

const DAY_MS = 1000 * 60 * 60 * 24;

export type HoursPaceLevel =
  | 'ok'
  | 'warning'
  | 'danger'
  | 'exceeded'
  | 'done_good'
  | 'done_late';

export interface HoursPaceInfo {
  level: HoursPaceLevel;
  label: string;
  message: string;
  projectedHours: number | null;
  commitmentDaysLeft: number;
  timelinePercent: number;
  hoursPercent: number;
}

export function plannedProjectDays(project: CreativeProject): number {
  const start = new Date(`${project.requestDate}T00:00:00`);
  const end = new Date(`${project.commitmentDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY_MS));
}

/** Horas presupuestadas: explícitas o 8 h por día de plazo. */
export function estimatedHoursForProject(project: CreativeProject): number {
  if (project.estimatedHours && project.estimatedHours > 0) return project.estimatedHours;
  return plannedProjectDays(project) * 8;
}

export function trackedHoursForProject(project: CreativeProject): number {
  return Math.round(((project.trackedMinutes ?? 0) / 60) * 10) / 10;
}

export function hoursProgressPercent(project: CreativeProject): number {
  const est = estimatedHoursForProject(project);
  if (est <= 0) return 0;
  return Math.min(150, Math.round(((project.trackedMinutes ?? 0) / 60 / est) * 100));
}

export function formatHoursMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export function isHoursExceeded(project: CreativeProject): boolean {
  const estMin = estimatedHoursForProject(project) * 60;
  return (project.trackedMinutes ?? 0) > estMin;
}

export function isEarlyDelivery(project: CreativeProject): boolean {
  if (project.status !== 'terminado') return false;
  const finished = project.finishedDate ?? project.completedAt?.slice(0, 10);
  if (!finished) return false;
  const onTime = finished <= project.commitmentDate;
  const underHours = !isHoursExceeded(project);
  return onTime && underHours;
}

export function enrichProjectHours(project: CreativeProject): CreativeProject {
  return {
    ...project,
    estimatedHours: estimatedHoursForProject(project),
    trackedMinutes: project.trackedMinutes ?? 0,
    timeLogs: project.timeLogs ?? [],
  };
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysUntilCommitment(project: CreativeProject, today = todayKey()): number {
  const end = new Date(`${project.commitmentDate}T00:00:00`);
  const now = new Date(`${today}T00:00:00`);
  if (Number.isNaN(end.getTime()) || Number.isNaN(now.getTime())) return 0;
  return Math.ceil((end.getTime() - now.getTime()) / DAY_MS);
}

/** Porcentaje del plazo calendario ya transcurrido (solicitud → compromiso). */
export function timelineProgressPercent(project: CreativeProject, today = todayKey()): number {
  const start = new Date(`${project.requestDate}T00:00:00`);
  const end = new Date(`${project.commitmentDate}T00:00:00`);
  const now = new Date(`${today}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const total = end.getTime() - start.getTime();
  if (total <= 0) return project.status === 'terminado' ? 100 : 50;
  if (project.status === 'terminado') return 100;
  const elapsed = now.getTime() - start.getTime();
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

/** Proyección de horas totales si se mantiene el ritmo actual. */
export function projectedTotalHours(project: CreativeProject, today = todayKey()): number | null {
  const timeline = timelineProgressPercent(project, today);
  const tracked = (project.trackedMinutes ?? 0) / 60;
  if (timeline < 8 || tracked < 0.25) return null;
  return Math.round((tracked / (timeline / 100)) * 10) / 10;
}

export function hoursPaceBarColor(level: HoursPaceLevel): string {
  switch (level) {
    case 'ok':
    case 'done_good':
      return '#10b981';
    case 'warning':
      return '#f59e0b';
    case 'danger':
    case 'done_late':
      return '#ef4444';
    case 'exceeded':
      return '#e2445c';
    default:
      return 'var(--accent)';
  }
}

/** Semáforo de ritmo: horas vs plazo y proyección de fin. */
export function getHoursPaceInfo(project: CreativeProject, today = todayKey()): HoursPaceInfo {
  const est = estimatedHoursForProject(project);
  const hoursPercent = hoursProgressPercent(project);
  const timelinePercent = timelineProgressPercent(project, today);
  const daysLeft = daysUntilCommitment(project, today);
  const projected = projectedTotalHours(project, today);
  const exceeded = isHoursExceeded(project);
  const trackedLabel = formatHoursMinutes(project.trackedMinutes ?? 0);

  const base = {
    projectedHours: projected,
    commitmentDaysLeft: daysLeft,
    timelinePercent,
    hoursPercent,
  };

  if (project.status === 'terminado') {
    const finished = project.finishedDate ?? project.completedAt?.slice(0, 10);
    const lateDate = finished ? finished > project.commitmentDate : false;
    if (exceeded || lateDate) {
      const parts: string[] = [];
      if (exceeded) parts.push(`superó el presupuesto (${trackedLabel} / ${est} h)`);
      if (lateDate) parts.push('entregó después del compromiso');
      return {
        ...base,
        level: 'done_late',
        label: 'Fuera de ritmo',
        message: `Proyecto concluido: ${parts.join(' y ')}.`,
      };
    }
    return {
      ...base,
      level: 'done_good',
      label: 'A tiempo',
      message: 'Entregado dentro del plazo y del presupuesto de horas.',
    };
  }

  if (exceeded) {
    return {
      ...base,
      level: 'exceeded',
      label: 'Horas excedidas',
      message: `Ya superaste el presupuesto (${trackedLabel} / ${est} h).`,
    };
  }

  if (daysLeft < 0) {
    return {
      ...base,
      level: 'danger',
      label: 'Fecha vencida',
      message: `El compromiso venció hace ${Math.abs(daysLeft)} día(s) y el proyecto sigue activo.`,
    };
  }

  if (projected !== null && projected > est * 1.08) {
    const level: HoursPaceLevel = projected > est * 1.2 ? 'danger' : 'warning';
    return {
      ...base,
      level,
      label: level === 'danger' ? 'Riesgo alto' : 'Riesgo de exceso',
      message: `Al ritmo actual terminarías en ~${projected} h (presupuesto: ${est} h).`,
    };
  }

  if (hoursPercent > timelinePercent + 15 && timelinePercent > 10) {
    return {
      ...base,
      level: 'warning',
      label: 'Gastando rápido',
      message: `Llevas ${hoursPercent}% del presupuesto de horas con solo ${timelinePercent}% del plazo transcurrido.`,
    };
  }

  if (daysLeft <= 2 && hoursPercent < 80) {
    return {
      ...base,
      level: 'warning',
      label: 'Fecha cercana',
      message: `Quedan ${daysLeft} día(s) para el compromiso y llevas ${hoursPercent}% de las horas.`,
    };
  }

  return {
    ...base,
    level: 'ok',
    label: 'A tiempo',
    message:
      daysLeft > 0
        ? `Ritmo saludable — ${daysLeft} día(s) hasta el compromiso.`
        : 'Ritmo saludable respecto al presupuesto de horas.',
  };
}
