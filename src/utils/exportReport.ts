import type { BoardState, TaskAssignment } from '../types';

export function exportTeamCsv(board: BoardState, assignments: TaskAssignment[]): void {
  const rows: string[][] = [
    [
      'Nombre',
      'Rol',
      'Trabajo actual',
      'Estado',
      'KPI actual',
      'KPI meta',
      'Objetivo',
      'Entrega',
      'Prioridad',
    ],
  ];

  for (const t of board.tasks) {
    rows.push([
      t.employeeName,
      t.roleTitle ?? t.department,
      t.currentWork,
      t.status,
      String(t.kpiCurrent),
      String(t.kpiTarget),
      t.objective,
      t.dueDate,
      t.priority,
    ]);
  }

  rows.push([]);
  rows.push(['--- Indicaciones ---']);
  rows.push([
    'Para',
    'De',
    'Título',
    'Estado',
    'Fecha límite',
    'Prioridad',
    'Creada',
  ]);

  for (const a of assignments) {
    rows.push([
      a.employeeName,
      a.assignedByName,
      a.title,
      a.status,
      a.dueDate,
      a.priority,
      a.createdAt.slice(0, 10),
    ]);
  }

  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `yaavs-reporte-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
