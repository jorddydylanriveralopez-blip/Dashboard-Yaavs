import type { CreativeProject } from '../types';

export interface WeekBucket {
  key: string;
  label: string;
  count: number;
}

/** Entregas (terminado) agrupadas por semana — últimas 8 semanas. */
export function buildWeeklyCompletionTrend(
  completedProjects: CreativeProject[],
): WeekBucket[] {
  const buckets: WeekBucket[] = [];
  const now = new Date();

  for (let i = 7; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(start.getDate() - i * 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const key = start.toISOString().slice(0, 10);
    const label =
      i === 0
        ? 'Esta sem.'
        : start.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    buckets.push({ key, label, count: 0 });
  }

  for (const p of completedProjects) {
    const raw = p.finishedDate ?? p.completedAt ?? p.updatedAt;
    if (!raw) continue;
    const d = new Date(raw);
    for (let i = 0; i < buckets.length; i++) {
      const start = new Date(buckets[i].key);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      if (d >= start && d < end) {
        buckets[i].count += 1;
        break;
      }
    }
  }

  return buckets;
}
