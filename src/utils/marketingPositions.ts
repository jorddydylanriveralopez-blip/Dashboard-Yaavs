import type { EmployeeTask } from '../types';
import { kpiPercent } from './kpiStats';

export interface MarketingPositionDef {
  id: string;
  title: string;
  employeeIds: string[];
}

/** Posiciones fijas del área y quién ocupa cada una. */
export const MARKETING_POSITIONS: MarketingPositionDef[] = [
  {
    id: 'multimedia',
    title: 'Diseñador Multimedia',
    employeeIds: ['emp-jesus'],
  },
  {
    id: 'uxui',
    title: 'Diseñador UX/UI',
    employeeIds: ['emp-jorddy'],
  },
  {
    id: 'grafico',
    title: 'Diseñador Gráfico',
    employeeIds: ['emp-andres', 'emp-andrea'],
  },
  {
    id: 'coordinador',
    title: 'Coordinador de Marketing',
    employeeIds: ['emp-juancarlos'],
  },
  {
    id: 'community',
    title: 'Community Manager',
    employeeIds: ['emp-yared'],
  },
];

export interface PositionMemberKpi {
  employeeId: string;
  employeeName: string;
  pct: number;
  task: EmployeeTask | null;
}

export interface PositionKpi {
  positionId: string;
  position: string;
  avgPct: number;
  members: PositionMemberKpi[];
}

export function buildPositionKpis(tasks: EmployeeTask[]): PositionKpi[] {
  const byEmployee = new Map(tasks.map((t) => [t.employeeId, t]));

  return MARKETING_POSITIONS.map((pos) => {
    const members: PositionMemberKpi[] = pos.employeeIds.map((employeeId) => {
      const task = byEmployee.get(employeeId) ?? null;
      return {
        employeeId,
        employeeName: task?.employeeName ?? employeeId,
        pct: task ? kpiPercent(task) : 0,
        task,
      };
    });

    const withData = members.filter((m) => m.task);
    const avgPct = withData.length
      ? Math.round(withData.reduce((sum, m) => sum + m.pct, 0) / withData.length)
      : 0;

    return {
      positionId: pos.id,
      position: pos.title,
      avgPct,
      members,
    };
  });
}

export function positionTitleForEmployee(employeeId: string): string | undefined {
  return MARKETING_POSITIONS.find((p) => p.employeeIds.includes(employeeId))?.title;
}
