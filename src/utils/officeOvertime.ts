import type { OfficeOvertimeEntry } from '../types';
import { OFFICE_OVERTIME_EXCLUDED_EMPLOYEE_ID } from '../constants';

/** Fin de jornada laboral: 18:00 hora local. */
export const OFFICE_DAY_END_HOUR = 18;

export function todayDateKey(now = Date.now()): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function canUseOfficeOvertime(employeeId: string | undefined | null): boolean {
  return Boolean(employeeId && employeeId !== OFFICE_OVERTIME_EXCLUDED_EMPLOYEE_ID);
}

/** 18:00 del día civil local de `ms`. */
export function sixPmMsOnLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(OFFICE_DAY_END_HOUR, 0, 0, 0);
  return d.getTime();
}

/**
 * Segundos de un intervalo [start, end] que caen después de las 18:00
 * (hora local), sumando por cada día si cruza medianoche.
 */
export function overtimeSecondsAfterSix(startMs: number, endMs: number): number {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return 0;
  }
  let total = 0;
  let cursor = startMs;
  while (cursor < endMs) {
    const dayEnd = new Date(cursor);
    dayEnd.setHours(23, 59, 59, 999);
    const segmentEnd = Math.min(endMs, dayEnd.getTime() + 1);
    const six = sixPmMsOnLocalDay(cursor);
    const from = Math.max(cursor, six);
    if (from < segmentEnd) {
      total += Math.floor((segmentEnd - from) / 1000);
    }
    cursor = segmentEnd;
  }
  return Math.max(0, total);
}

/** Segundos vivos de tiempo extra después de las 6:00 p.m. (hoy + en curso). */
export function liveOvertimeSeconds(
  entry: OfficeOvertimeEntry | undefined,
  nowMs = Date.now(),
): number {
  if (!entry) return 0;
  const today = todayDateKey(nowMs);
  let seconds = entry.todayDate === today ? Math.max(0, entry.todaySeconds || 0) : 0;
  if (entry.runningStartedAt) {
    const started = Date.parse(entry.runningStartedAt);
    if (Number.isFinite(started)) {
      seconds += overtimeSecondsAfterSix(started, nowMs);
    }
  }
  return seconds;
}

export function formatOvertimeClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatOvertimeShort(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  if (safe < 60) return `${safe} s`;
  if (h <= 0) return `${m} min`;
  if (m <= 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export function isOvertimeRunning(entry: OfficeOvertimeEntry | undefined): boolean {
  return Boolean(entry?.runningStartedAt);
}

/** ¿Todavía no son las 6:00 p.m. locales? */
export function isBeforeSixPm(nowMs = Date.now()): boolean {
  return nowMs < sixPmMsOnLocalDay(nowMs);
}
