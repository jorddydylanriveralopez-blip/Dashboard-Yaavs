import type { CreativeProject, ProjectStatus } from '../types';

export type TimelineTone = 'ok' | 'soon' | 'urgent' | 'overdue' | 'done' | 'none';

export interface ProjectTimelineInfo {
  dueDate: string | null;
  requestDate: string;
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  progressPercent: number;
  tone: TimelineTone;
  label: string;
  shortLabel: string;
  remainingMs: number;
  /** Ms de retraso cuando ya pasó la entrega (0 si no aplica). */
  overdueMs: number;
  totalMs: number;
  elapsedMs: number;
  isComplete: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function projectDueDate(
  project: Pick<CreativeProject, 'finishedDate' | 'commitmentDate'>,
): string | null {
  return project.finishedDate ?? project.commitmentDate ?? null;
}

export function daysBetweenDates(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / DAY_MS));
}

function endOfDayMs(isoDate: string): number {
  return new Date(`${isoDate}T23:59:59`).getTime();
}

function startOfDayMs(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00`).getTime();
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatLiveCountdown(remainingMs: number): string {
  const safe = Math.max(0, remainingMs);
  const totalSec = Math.floor(safe / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) {
    return `${days}d ${pad2(hours)}:${pad2(mins)}:${pad2(secs)}`;
  }
  return `${pad2(hours)}:${pad2(mins)}:${pad2(secs)}`;
}

/** Texto del cronómetro: restante o retraso en vivo. */
export function formatDeadlineClock(info: ProjectTimelineInfo): string | null {
  if (info.isComplete || info.tone === 'none') return null;
  if (info.overdueMs > 0) return `+${formatLiveCountdown(info.overdueMs)}`;
  if (info.remainingMs > 0) return formatLiveCountdown(info.remainingMs);
  return '00:00:00';
}

export function getProjectTimelineInfo(
  project: Pick<CreativeProject, 'requestDate' | 'finishedDate' | 'commitmentDate' | 'status'>,
  now = Date.now(),
): ProjectTimelineInfo {
  const requestDate = project.requestDate;
  const dueDate = projectDueDate(project);
  const isComplete = project.status === 'terminado';

  if (!dueDate) {
    return {
      dueDate: null,
      requestDate,
      totalDays: 0,
      elapsedDays: 0,
      remainingDays: 0,
      progressPercent: 0,
      tone: 'none',
      label: 'Sin fecha de entrega',
      shortLabel: '—',
      remainingMs: 0,
      overdueMs: 0,
      totalMs: 0,
      elapsedMs: 0,
      isComplete,
    };
  }

  const startMs = startOfDayMs(requestDate);
  const endMs = endOfDayMs(dueDate);
  const totalMs = Math.max(DAY_MS, endMs - startMs);
  const elapsedMs = Math.min(totalMs, Math.max(0, now - startMs));
  const remainingMs = Math.max(0, endMs - now);
  const overdueMs = !isComplete && now > endMs ? now - endMs : 0;

  const totalDays = daysBetweenDates(requestDate, dueDate);
  const elapsedDays = Math.min(
    totalDays,
    Math.max(0, Math.ceil((now - startMs) / DAY_MS)),
  );
  const remainingDays = Math.max(0, Math.ceil(remainingMs / DAY_MS));
  const progressPercent = isComplete
    ? 100
    : Math.min(100, Math.round((elapsedMs / totalMs) * 100));

  let tone: TimelineTone;
  let label: string;
  let shortLabel: string;

  if (isComplete) {
    tone = 'done';
    label = 'Proyecto entregado';
    shortLabel = 'Listo';
  } else if (now > endMs) {
    const overdueDays = Math.max(1, Math.ceil((now - endMs) / DAY_MS));
    tone = 'overdue';
    label = overdueDays === 1 ? '1 día de retraso' : `${overdueDays} días de retraso`;
    shortLabel = `+${overdueDays}d`;
  } else if (remainingDays === 0) {
    tone = 'urgent';
    label = 'Entrega hoy';
    shortLabel = 'Hoy';
  } else if (remainingDays === 1) {
    tone = 'urgent';
    label = 'Falta 1 día';
    shortLabel = '1d';
  } else if (remainingDays <= 3) {
    tone = 'soon';
    label = `Faltan ${remainingDays} días`;
    shortLabel = `${remainingDays}d`;
  } else {
    tone = 'ok';
    label = `Faltan ${remainingDays} días`;
    shortLabel = `${remainingDays}d`;
  }

  return {
    dueDate,
    requestDate,
    totalDays,
    elapsedDays,
    remainingDays,
    progressPercent,
    tone,
    label,
    shortLabel,
    remainingMs,
    overdueMs,
    totalMs,
    elapsedMs,
    isComplete,
  };
}

export function isActiveProjectStatus(status: ProjectStatus): boolean {
  return status !== 'terminado';
}
