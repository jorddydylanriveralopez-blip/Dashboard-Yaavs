import type { OfficeOvertimeEntry } from '../types';
import { OFFICE_OVERTIME_EXCLUDED_EMPLOYEE_ID } from '../constants';

export function todayDateKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function canUseOfficeOvertime(employeeId: string | undefined | null): boolean {
  return Boolean(employeeId && employeeId !== OFFICE_OVERTIME_EXCLUDED_EMPLOYEE_ID);
}

/** Segundos vivos de tiempo extra “hoy” (incluye cronómetro en curso). */
export function liveOvertimeSeconds(
  entry: OfficeOvertimeEntry | undefined,
  nowMs = Date.now(),
): number {
  if (!entry) return 0;
  const today = todayDateKey(nowMs);
  let seconds = entry.todayDate === today ? Math.max(0, entry.todaySeconds || 0) : 0;
  if (entry.runningStartedAt) {
    const runDate = entry.runningDate || entry.runningStartedAt.slice(0, 10);
    if (runDate === today) {
      const started = Date.parse(entry.runningStartedAt);
      if (Number.isFinite(started)) {
        seconds += Math.max(0, Math.floor((nowMs - started) / 1000));
      }
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
  if (h <= 0) return `${m} min`;
  if (m <= 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export function isOvertimeRunning(entry: OfficeOvertimeEntry | undefined): boolean {
  return Boolean(entry?.runningStartedAt);
}
