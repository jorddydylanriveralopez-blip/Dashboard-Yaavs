import type { EmployeeTask } from '../types';

export function kpiPercent(task: EmployeeTask): number {
  if (!task.kpiTarget) return 0;
  return Math.min(100, Math.round((task.kpiCurrent / task.kpiTarget) * 100));
}

export type KpiBucket = 'excelente' | 'en_camino' | 'atencion' | 'critico';

export function kpiBucket(pct: number): KpiBucket {
  if (pct >= 80) return 'excelente';
  if (pct >= 50) return 'en_camino';
  if (pct >= 25) return 'atencion';
  return 'critico';
}

export const KPI_BUCKET_LABELS: Record<KpiBucket, string> = {
  excelente: 'En meta (≥80%)',
  en_camino: 'En camino (50–79%)',
  atencion: 'Requiere impulso (25–49%)',
  critico: 'Prioridad alta (menos de 25%)',
};

export interface DepartmentKpi {
  department: string;
  avgPct: number;
  count: number;
  tasks: EmployeeTask[];
}

export interface KpiMonthSummary {
  monthLabel: string;
  teamAvg: number;
  totalPeople: number;
  buckets: Record<KpiBucket, number>;
  departments: DepartmentKpi[];
  sortedByKpi: EmployeeTask[];
}

export function buildKpiMonthSummary(tasks: EmployeeTask[]): KpiMonthSummary {
  const monthLabel = new Date().toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
  });

  const buckets: Record<KpiBucket, number> = {
    excelente: 0,
    en_camino: 0,
    atencion: 0,
    critico: 0,
  };

  for (const task of tasks) {
    buckets[kpiBucket(kpiPercent(task))] += 1;
  }

  const pcts = tasks.map(kpiPercent);
  const teamAvg = pcts.length
    ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
    : 0;

  const deptMap = new Map<string, EmployeeTask[]>();
  for (const task of tasks) {
    const key = task.roleTitle ?? task.department;
    const list = deptMap.get(key) ?? [];
    list.push(task);
    deptMap.set(key, list);
  }

  const departments: DepartmentKpi[] = [...deptMap.entries()]
    .map(([department, deptTasks]) => ({
      department,
      avgPct: Math.round(
        deptTasks.reduce((sum, t) => sum + kpiPercent(t), 0) / deptTasks.length,
      ),
      count: deptTasks.length,
      tasks: deptTasks,
    }))
    .sort((a, b) => b.avgPct - a.avgPct);

  const sortedByKpi = [...tasks].sort(
    (a, b) => kpiPercent(b) - kpiPercent(a),
  );

  return {
    monthLabel,
    teamAvg,
    totalPeople: tasks.length,
    buckets,
    departments,
    sortedByKpi,
  };
}
