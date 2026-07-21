import type {
  AttendanceStore,
  CreativeProject,
  DailyKpiStore,
  EmployeeTask,
} from '../types';
import { getMonthKey } from './performanceHistory';
import { getDeadlineInfo } from './deadline';
import { isActiveProject } from './activeItems';
import {
  buildPanoramaMemberDetails,
  type PanoramaMemberDetail,
} from './panoramaDetail';

export interface PersonalObservation extends PanoramaMemberDetail {
  tips: string[];
}

function toSecondPerson(text: string): string {
  return text
    .replace(/^Su /, 'Tu ')
    .replace(/ su /g, ' tu ')
    .replace(/Por encima del promedio/, 'Estás por encima del promedio')
    .replace(/Avance por debajo del promedio/, 'Tu avance está por debajo del promedio')
    .replace(/Rendimiento estable en el periodo/, 'Vas con un ritmo estable este mes')
    .replace(/Inasistencias registradas:/, 'Tus inasistencias:')
    .replace(/proyecto\(s\) sin entregar/, 'proyecto(s) tuyo(s) sin entregar')
    .replace(/proyecto\(s\) activo\(s\) aún sin cerrar/, 'proyecto(s) activo(s) tuyo(s) sin cerrar')
    .replace(/No tiene proyectos activos pendientes/, 'No tienes proyectos activos pendientes');
}

function buildActionTips(
  detail: PanoramaMemberDetail,
  activeProjects: CreativeProject[],
): string[] {
  const tips: string[] = [];

  const overdue = activeProjects.filter(
    (p) => getDeadlineInfo(p.commitmentDate, 'en_progreso').tone === 'overdue',
  );
  if (overdue.length > 0) {
    tips.push(
      `Cierra primero «${overdue[0].projectName.trim() || 'tu proyecto más urgente'}» y sube la evidencia de entrega.`,
    );
  }

  if (detail.projectsHoursExceeded > 0) {
    tips.push('Registra tus horas con el cronómetro y evita pasarte del tiempo presupuestado.');
  }

  if (detail.projectsLate > 0) {
    tips.push('Planea mejor las fechas de compromiso y avisa antes si no vas a llegar a tiempo.');
  }

  if (detail.attendanceRate < 85) {
    tips.push('Mejora tu puntualidad y asistencia para no perder ritmo con el equipo.');
  }

  if (detail.kpiChange < 0) {
    tips.push('Revisa tus pendientes en Proyectos y marca avances pequeños cada día.');
  }

  if (detail.daysDown > detail.daysUp) {
    tips.push('Intenta cerrar al menos una tarea por semana para recuperar avance.');
  }

  if (tips.length === 0 && detail.kpiPercent < 70) {
    tips.push('Enfócate en una entrega esta semana para subir tu avance del mes.');
  }

  if (tips.length === 0) {
    tips.push('Mantén el ritmo: entrega a tiempo, registra horas y asiste con constancia.');
  }

  return tips.slice(0, 3);
}

export function buildPersonalObservationForEmployee(
  employeeId: string,
  input: {
    monthKey?: string;
    tasks: EmployeeTask[];
    dailyKpiStore: DailyKpiStore;
    allProjects: CreativeProject[];
    attendanceStore: AttendanceStore;
    activeProjects?: CreativeProject[];
  },
): PersonalObservation | null {
  const monthKey = input.monthKey ?? getMonthKey();
  const members = buildPanoramaMemberDetails({
    monthKey,
    tasks: input.tasks,
    dailyKpiStore: input.dailyKpiStore,
    allProjects: input.allProjects,
    attendanceStore: input.attendanceStore,
  });

  const member = members.find((m) => m.employeeId === employeeId);
  if (!member) return null;

  const activeProjects =
    input.activeProjects ??
    input.allProjects.filter(
      (p) => isActiveProject(p) && p.assignedEmployeeId === employeeId,
    );

  return {
    ...member,
    strengths: member.strengths.map(toSecondPerson),
    improvements: member.improvements.map(toSecondPerson),
    tips: buildActionTips(member, activeProjects),
  };
}

export function buildTeamObservations(input: {
  monthKey?: string;
  tasks: EmployeeTask[];
  dailyKpiStore: DailyKpiStore;
  allProjects: CreativeProject[];
  attendanceStore: AttendanceStore;
}): PanoramaMemberDetail[] {
  const monthKey = input.monthKey ?? getMonthKey();
  return buildPanoramaMemberDetails({
    monthKey,
    tasks: input.tasks,
    dailyKpiStore: input.dailyKpiStore,
    allProjects: input.allProjects,
    attendanceStore: input.attendanceStore,
  });
}
